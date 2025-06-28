-- Add Geocoding Support for Map Visualization
-- Migration: 20250103000000_add_geocoding_support.sql

-- ============================================================================
-- WATER SYSTEM LOCATIONS TABLE
-- ============================================================================

-- Create dedicated table for water system locations and geocoding
CREATE TABLE IF NOT EXISTS water_system_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pwsid VARCHAR(9) NOT NULL,
    submission_year_quarter VARCHAR(7) NOT NULL,
    
    -- Geocoded coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Address components (normalized from public_water_systems)
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city_name VARCHAR(40),
    state_code VARCHAR(2),
    zip_code VARCHAR(14),
    county_name VARCHAR(40),
    
    -- Full formatted address for geocoding
    full_address TEXT,
    
    -- Geocoding metadata
    geocoded_at TIMESTAMP WITH TIME ZONE,
    geocoding_accuracy VARCHAR(20), -- ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE
    geocoding_source VARCHAR(50), -- google, mapbox, openstreetmap, etc.
    geocoding_confidence DECIMAL(3, 2), -- 0.0 to 1.0
    
    -- Spatial data for advanced queries
    geom GEOMETRY(POINT, 4326),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(pwsid, submission_year_quarter),
    FOREIGN KEY (submission_year_quarter, pwsid) 
        REFERENCES public_water_systems(submission_year_quarter, pwsid) ON DELETE CASCADE
);

-- ============================================================================
-- VIOLATION LOCATIONS TABLE
-- ============================================================================

-- Create table specifically for violation locations (inherits from water system locations)
CREATE TABLE IF NOT EXISTS violation_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_id VARCHAR(20) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    submission_year_quarter VARCHAR(7) NOT NULL,
    
    -- Reference to water system location
    water_system_location_id UUID,
    
    -- Override coordinates if violation has specific facility location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    facility_id VARCHAR(12), -- If violation is tied to specific facility
    
    -- Calculated from violation data
    severity_level VARCHAR(20), -- critical, warning, moderate, low
    map_color VARCHAR(7), -- hex color for map display
    violation_count INTEGER DEFAULT 1,
    
    -- Aggregation flags
    is_health_based BOOLEAN DEFAULT FALSE,
    is_unaddressed BOOLEAN DEFAULT FALSE,
    
    -- Temporal data
    violation_begin_date DATE,
    violation_end_date DATE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(violation_id, pwsid),
    FOREIGN KEY (water_system_location_id) REFERENCES water_system_locations(id) ON DELETE SET NULL,
    FOREIGN KEY (submission_year_quarter, pwsid, violation_id) 
        REFERENCES violations_enforcement(submission_year_quarter, pwsid, violation_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_wsl_coordinates ON water_system_locations(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wsl_geom ON water_system_locations USING GIST(geom)
WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vl_coordinates ON violation_locations(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_wsl_pwsid ON water_system_locations(pwsid);
CREATE INDEX IF NOT EXISTS idx_wsl_geocoded ON water_system_locations(geocoded_at) 
WHERE geocoded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vl_pwsid ON violation_locations(pwsid);
CREATE INDEX IF NOT EXISTS idx_vl_severity ON violation_locations(severity_level);
CREATE INDEX IF NOT EXISTS idx_vl_health_based ON violation_locations(is_health_based) WHERE is_health_based = TRUE;

-- ============================================================================
-- MAP-READY VIEWS
-- ============================================================================

-- View for violations with location data ready for map display
CREATE OR REPLACE VIEW violations_map_data AS
SELECT 
    vl.violation_id,
    vl.pwsid,
    p.pws_name,
    COALESCE(vl.latitude, wsl.latitude) as latitude,
    COALESCE(vl.longitude, wsl.longitude) as longitude,
    wsl.full_address,
    wsl.county_name,
    p.population_served_count,
    p.pws_type_code,
    v.violation_status,
    v.is_health_based_ind,
    v.violation_category_code,
    v.contaminant_code,
    v.non_compl_per_begin_date,
    v.non_compl_per_end_date,
    g.county_served,
    g.city_served,
    g.zip_code_served,
    rc_cont.value_description as contaminant_name,
    rc_viol.value_description as violation_description,
    vl.severity_level,
    vl.map_color,
    vl.violation_count,
    wsl.geocoding_accuracy,
    wsl.geocoded_at
FROM violation_locations vl
JOIN water_system_locations wsl ON vl.water_system_location_id = wsl.id
JOIN public_water_systems p ON vl.pwsid = p.pwsid AND p.submission_year_quarter = '2025Q1'
JOIN violations_enforcement v ON vl.violation_id = v.violation_id AND vl.pwsid = v.pwsid
LEFT JOIN geographic_areas g ON vl.pwsid = g.pwsid AND g.area_type_code = 'CN'
LEFT JOIN reference_codes rc_cont ON rc_cont.value_type = 'CONTAMINANT_CODE' 
    AND rc_cont.value_code = v.contaminant_code
LEFT JOIN reference_codes rc_viol ON rc_viol.value_type = 'VIOLATION_CODE' 
    AND rc_viol.value_code = v.violation_code
WHERE (vl.latitude IS NOT NULL OR wsl.latitude IS NOT NULL)
    AND (vl.longitude IS NOT NULL OR wsl.longitude IS NOT NULL)
    AND p.pws_activity_code = 'A';

-- View for county-level aggregation
CREATE OR REPLACE VIEW county_violations_map AS
SELECT 
    wsl.county_name,
    wsl.state_code,
    COUNT(DISTINCT vl.pwsid) as systems_with_violations,
    COUNT(vl.violation_id) as total_violations,
    COUNT(CASE WHEN vl.is_health_based THEN 1 END) as health_violations,
    COUNT(CASE WHEN vl.is_unaddressed THEN 1 END) as unaddressed_violations,
    CASE 
        WHEN COUNT(CASE WHEN vl.is_health_based AND vl.is_unaddressed THEN 1 END) > 0 THEN 'critical'
        WHEN COUNT(CASE WHEN vl.is_health_based THEN 1 END) > 0 THEN 'warning'
        WHEN COUNT(CASE WHEN vl.is_unaddressed THEN 1 END) > 0 THEN 'moderate'
        ELSE 'low'
    END as county_severity_level,
    -- Calculate approximate county center from system locations
    AVG(wsl.latitude) as avg_latitude,
    AVG(wsl.longitude) as avg_longitude
FROM violation_locations vl
JOIN water_system_locations wsl ON vl.water_system_location_id = wsl.id
WHERE wsl.latitude IS NOT NULL AND wsl.longitude IS NOT NULL
GROUP BY wsl.county_name, wsl.state_code;

-- ============================================================================
-- FUNCTIONS FOR DATA MANAGEMENT
-- ============================================================================

-- Function to populate water system locations from existing PWS data
CREATE OR REPLACE FUNCTION populate_water_system_locations()
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER := 0;
BEGIN
    INSERT INTO water_system_locations (
        pwsid, 
        submission_year_quarter,
        address_line1,
        address_line2,
        city_name,
        state_code,
        zip_code,
        full_address
    )
    SELECT 
        p.pwsid,
        p.submission_year_quarter,
        p.address_line1,
        p.address_line2,
        p.city_name,
        p.state_code,
        p.zip_code,
        CASE 
            WHEN p.address_line1 IS NOT NULL AND p.city_name IS NOT NULL AND p.state_code IS NOT NULL THEN
                CONCAT(
                    COALESCE(p.address_line1, ''),
                    CASE WHEN p.address_line2 IS NOT NULL AND p.address_line2 != '' THEN ', ' || p.address_line2 ELSE '' END,
                    ', ', COALESCE(p.city_name, ''),
                    ', ', COALESCE(p.state_code, ''),
                    CASE WHEN p.zip_code IS NOT NULL AND p.zip_code != '' THEN ' ' || p.zip_code ELSE '' END
                )
            ELSE NULL
        END as full_address
    FROM public_water_systems p
    WHERE p.submission_year_quarter = '2025Q1'
        AND p.pws_activity_code = 'A'
        AND NOT EXISTS (
            SELECT 1 FROM water_system_locations wsl 
            WHERE wsl.pwsid = p.pwsid AND wsl.submission_year_quarter = p.submission_year_quarter
        );
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to populate violation locations
CREATE OR REPLACE FUNCTION populate_violation_locations()
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER := 0;
BEGIN
    INSERT INTO violation_locations (
        violation_id,
        pwsid,
        submission_year_quarter,
        water_system_location_id,
        facility_id,
        severity_level,
        map_color,
        is_health_based,
        is_unaddressed,
        violation_begin_date,
        violation_end_date
    )
    SELECT 
        v.violation_id,
        v.pwsid,
        v.submission_year_quarter,
        wsl.id as water_system_location_id,
        v.facility_id,
        CASE 
            WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 'critical'
            WHEN v.is_health_based_ind = 'Y' THEN 'warning'
            WHEN v.violation_status = 'Unaddressed' THEN 'moderate'
            ELSE 'low'
        END as severity_level,
        CASE 
            WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN '#dc2626'
            WHEN v.is_health_based_ind = 'Y' THEN '#f59e0b'
            WHEN v.violation_status = 'Unaddressed' THEN '#3b82f6'
            ELSE '#10b981'
        END as map_color,
        (v.is_health_based_ind = 'Y') as is_health_based,
        (v.violation_status = 'Unaddressed') as is_unaddressed,
        v.non_compl_per_begin_date,
        v.non_compl_per_end_date
    FROM violations_enforcement v
    JOIN water_system_locations wsl ON v.pwsid = wsl.pwsid 
        AND v.submission_year_quarter = wsl.submission_year_quarter
    WHERE NOT EXISTS (
        SELECT 1 FROM violation_locations vl 
        WHERE vl.violation_id = v.violation_id AND vl.pwsid = v.pwsid
    );
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get systems needing geocoding
CREATE OR REPLACE FUNCTION get_systems_needing_geocoding(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    pwsid VARCHAR(9),
    pws_name VARCHAR(100),
    full_address TEXT,
    population_served INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wsl.pwsid,
        p.pws_name,
        wsl.full_address,
        p.population_served_count
    FROM water_system_locations wsl
    JOIN public_water_systems p ON wsl.pwsid = p.pwsid 
        AND wsl.submission_year_quarter = p.submission_year_quarter
    WHERE wsl.submission_year_quarter = '2025Q1'
        AND wsl.full_address IS NOT NULL
        AND wsl.latitude IS NULL
        AND wsl.longitude IS NULL
        AND p.pws_activity_code = 'A'
    ORDER BY p.population_served_count DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update coordinates for a system
CREATE OR REPLACE FUNCTION update_system_coordinates(
    system_pwsid VARCHAR(9),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    accuracy VARCHAR(20) DEFAULT 'APPROXIMATE',
    source VARCHAR(50) DEFAULT 'manual',
    confidence DECIMAL(3, 2) DEFAULT 0.8
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE water_system_locations 
    SET 
        latitude = lat,
        longitude = lng,
        geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326),
        geocoded_at = NOW(),
        geocoding_accuracy = accuracy,
        geocoding_source = source,
        geocoding_confidence = confidence,
        updated_at = NOW()
    WHERE pwsid = system_pwsid 
        AND submission_year_quarter = '2025Q1';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update geom column when lat/lng changes
CREATE OR REPLACE FUNCTION update_geom_from_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.geom = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wsl_geom 
    BEFORE INSERT OR UPDATE ON water_system_locations
    FOR EACH ROW EXECUTE FUNCTION update_geom_from_coordinates();

-- Update updated_at timestamp
CREATE TRIGGER trigger_update_wsl_updated_at 
    BEFORE UPDATE ON water_system_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_vl_updated_at 
    BEFORE UPDATE ON violation_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE water_system_locations IS 'Geocoded locations for public water systems';
COMMENT ON TABLE violation_locations IS 'Location-specific data for violations, optimized for map display';
COMMENT ON VIEW violations_map_data IS 'Map-ready view of violations with coordinates and visual styling';
COMMENT ON VIEW county_violations_map IS 'County-level aggregation for choropleth map visualization';
COMMENT ON FUNCTION populate_water_system_locations() IS 'Populates location table from existing PWS data';
COMMENT ON FUNCTION populate_violation_locations() IS 'Populates violation locations from violations_enforcement table'; 