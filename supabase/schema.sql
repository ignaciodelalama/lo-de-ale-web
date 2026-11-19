-- ==============================================================================
-- LO DE ALE BARBERÍA - SCHEMA MULTISUCURSAL PARA SUPABASE
-- ==============================================================================
-- Incluye soporte para múltiples sedes (City Bell y Villa Elisa), barberos
-- compartidos por día/sucursal, turnos y bloqueos.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE SUCURSALES
CREATE TABLE IF NOT EXISTS public.sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(60) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono_whatsapp VARCHAR(40),
    google_maps_url TEXT,
    horarios_texto VARCHAR(200),
    activa BOOLEAN DEFAULT true,
    orden INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE BARBEROS
CREATE TABLE IF NOT EXISTS public.barberos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(60) DEFAULT 'Barbero',
    foto TEXT,
    horarios JSONB DEFAULT '{}'::jsonb, -- { "1": [{"sucursal_id": "...", "desde": "09:30", "hasta": "20:00"}] }
    activo BOOLEAN DEFAULT true,
    orden INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE SERVICIOS
CREATE TABLE IF NOT EXISTS public.servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    duracion_minutos INT NOT NULL DEFAULT 45,
    precio NUMERIC(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    orden INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE TURNOS (RESERVAS)
CREATE TABLE IF NOT EXISTS public.turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
    barbero_id UUID NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
    servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
    cliente_nombre VARCHAR(120) NOT NULL,
    cliente_telefono VARCHAR(40) NOT NULL,
    cliente_email VARCHAR(120),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    estado VARCHAR(20) DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'atendido', 'cancelado', 'ausente')),
    atendido_at TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_turno_barbero_horario UNIQUE (barbero_id, fecha_inicio)
);

-- 5. TABLA DE BLOQUEOS DE HORARIO
CREATE TABLE IF NOT EXISTS public.bloqueos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE CASCADE, -- NULL = todas las sedes
    barbero_id UUID REFERENCES public.barberos(id) ON DELETE CASCADE,   -- NULL = todos los barberos
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo VARCHAR(150) DEFAULT 'Horario no disponible',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_turnos_sucursal_fecha ON public.turnos(sucursal_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_turnos_barbero_fecha ON public.turnos(barbero_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_bloqueos_sucursal_fecha ON public.bloqueos(sucursal_id, fecha_inicio);

-- ==============================================================================
-- FUNCIÓN RPC: reservar_turno (con validación de superposición)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reservar_turno(
    p_sucursal_id UUID,
    p_barbero_id UUID,
    p_servicio_id UUID,
    p_cliente_nombre TEXT,
    p_cliente_telefono TEXT,
    p_cliente_email TEXT,
    p_fecha_inicio TIMESTAMP WITH TIME ZONE,
    p_fecha_fin TIMESTAMP WITH TIME ZONE,
    p_notas TEXT DEFAULT ''
) RETURNS public.turnos AS $$
DECLARE
    v_conflicto BOOLEAN;
    v_turno public.turnos;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.turnos
        WHERE barbero_id = p_barbero_id
          AND estado IN ('confirmado', 'atendido')
          AND p_fecha_inicio < fecha_fin
          AND p_fecha_fin > fecha_inicio
    ) INTO v_conflicto;

    IF v_conflicto THEN
        RAISE EXCEPTION 'El horario se superpone con otro turno existente';
    END IF;

    INSERT INTO public.turnos (
        sucursal_id, barbero_id, servicio_id, cliente_nombre,
        cliente_telefono, cliente_email, fecha_inicio, fecha_fin, notas, estado
    ) VALUES (
        p_sucursal_id, p_barbero_id, p_servicio_id, p_cliente_nombre,
        p_cliente_telefono, p_cliente_email, p_fecha_inicio, p_fecha_fin, p_notas, 'confirmado'
    ) RETURNING * INTO v_turno;

    RETURN v_turno;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
