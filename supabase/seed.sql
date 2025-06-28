-- Georgia Water Quality Data Seed File
-- This file handles initial reference data and can be extended for sample data

-- Clear existing data in development (be careful in production!)
-- TRUNCATE TABLE violations_enforcement CASCADE;
-- TRUNCATE TABLE geographic_areas CASCADE;
-- TRUNCATE TABLE facilities CASCADE;
-- TRUNCATE TABLE public_water_systems CASCADE;
-- TRUNCATE TABLE reference_codes CASCADE;

-- ============================================================================
-- REFERENCE DATA - Critical for application functionality
-- ============================================================================

-- Insert common violation codes (these will be expanded when CSV is imported)
INSERT INTO reference_codes (value_type, value_code, value_description) VALUES
('VIOLATION_CODE', '01', 'Acute Maximum Contaminant Level Violation'),
('VIOLATION_CODE', '02', 'Monthly Maximum Contaminant Level Violation'),
('VIOLATION_CODE', '03', 'Monitoring, Regular Violation'),
('VIOLATION_CODE', '04', 'Monitoring, Repeat Violation'),
('VIOLATION_CODE', '05', 'Monitoring, Confirmation Violation'),
('VIOLATION_CODE', '09', 'Other Monitoring Violation'),
('VIOLATION_CODE', '10', 'Reporting Violation'),
('VIOLATION_CODE', '11', 'Other Reporting Violation'),
('VIOLATION_CODE', '23', 'Monitoring & Reporting, Routine Major Violation'),

('VIOLATION_CATEGORY_CODE', 'MCL', 'Maximum Contaminant Level'),
('VIOLATION_CATEGORY_CODE', 'MRDL', 'Maximum Residual Disinfectant Level'),
('VIOLATION_CATEGORY_CODE', 'TT', 'Treatment Technique'),
('VIOLATION_CATEGORY_CODE', 'MR', 'Monitoring and Reporting'),
('VIOLATION_CATEGORY_CODE', 'MON', 'Monitoring'),
('VIOLATION_CATEGORY_CODE', 'RPT', 'Reporting'),
('VIOLATION_CATEGORY_CODE', 'Other', 'Other Violation'),

('PWS_TYPE_CODE', 'CWS', 'Community Water System'),
('PWS_TYPE_CODE', 'NTNCWS', 'Non-Transient Non-Community Water System'),
('PWS_TYPE_CODE', 'TNCWS', 'Transient Non-Community Water System'),

('PWS_ACTIVITY_CODE', 'A', 'Active'),
('PWS_ACTIVITY_CODE', 'I', 'Inactive'),
('PWS_ACTIVITY_CODE', 'N', 'Changed from public to non-public'),
('PWS_ACTIVITY_CODE', 'M', 'Merged with another system'),
('PWS_ACTIVITY_CODE', 'P', 'Potential future system to be regulated'),

('VIOLATION_STATUS', 'Resolved', 'The violation has been resolved'),
('VIOLATION_STATUS', 'Archived', 'The violation is archived (>5 years old)'),
('VIOLATION_STATUS', 'Addressed', 'The violation has been addressed by formal enforcement'),
('VIOLATION_STATUS', 'Unaddressed', 'The violation has not been addressed'),

('OWNER_TYPE_CODE', 'F', 'Federal government'),
('OWNER_TYPE_CODE', 'L', 'Local government'),
('OWNER_TYPE_CODE', 'M', 'Public/Private'),
('OWNER_TYPE_CODE', 'N', 'Native American'),
('OWNER_TYPE_CODE', 'P', 'Private'),
('OWNER_TYPE_CODE', 'S', 'State government'),

('PRIMARY_SOURCE_CODE', 'GW', 'Ground water'),
('PRIMARY_SOURCE_CODE', 'GWP', 'Ground water purchased'),
('PRIMARY_SOURCE_CODE', 'SW', 'Surface water'),
('PRIMARY_SOURCE_CODE', 'SWP', 'Surface water purchased'),
('PRIMARY_SOURCE_CODE', 'GU', 'Groundwater under influence of surface water'),
('PRIMARY_SOURCE_CODE', 'GUP', 'Purchased ground water under influence of surface water'),

('AREA_TYPE_CODE', 'TR', 'Tribal'),
('AREA_TYPE_CODE', 'CN', 'County'),
('AREA_TYPE_CODE', 'ZC', 'Zip Code'),
('AREA_TYPE_CODE', 'CT', 'City'),
('AREA_TYPE_CODE', 'IR', 'Indian Reservation'),

('RULE_FAMILY_CODE', '100', 'Microbials'),
('RULE_FAMILY_CODE', '200', 'Disinfectants and Disinfection Byproducts'),
('RULE_FAMILY_CODE', '300', 'Chemicals'),
('RULE_FAMILY_CODE', '400', 'Other'),
('RULE_FAMILY_CODE', '500', 'Not Regulated')

ON CONFLICT (value_type, value_code) DO UPDATE SET
    value_description = EXCLUDED.value_description,
    updated_at = NOW();

-- ============================================================================
-- SAMPLE DATA FOR TESTING (Optional - remove in production)
-- ============================================================================

-- Insert a sample water system for testing
INSERT INTO public_water_systems (
    submission_year_quarter,
    pwsid,
    pws_name,
    pws_type_code,
    population_served_count,
    state_code,
    pws_activity_code,
    primary_source_code,
    owner_type_code
) VALUES (
    '2025Q1',
    'GA0000001',
    'Test Water System',
    'CWS',
    1000,
    'GA',
    'A',
    'GW',
    'L'
) ON CONFLICT (submission_year_quarter, pwsid) DO NOTHING;

-- Insert sample geographic area
INSERT INTO geographic_areas (
    submission_year_quarter,
    pwsid,
    geo_id,
    area_type_code,
    county_served,
    city_served,
    state_served
) VALUES (
    '2025Q1',
    'GA0000001',
    'GEO001',
    'CN',
    'Fulton',
    'Atlanta',
    'GA'
) ON CONFLICT (submission_year_quarter, pwsid, geo_id) DO NOTHING;

-- ============================================================================
-- UTILITY FUNCTIONS FOR DATA IMPORT
-- ============================================================================

-- Function to clean and standardize PWS IDs
CREATE OR REPLACE FUNCTION clean_pwsid(input_pwsid TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove any whitespace and ensure proper format
    RETURN TRIM(UPPER(input_pwsid));
END;
$$ LANGUAGE plpgsql;

-- Function to parse dates in MM/DD/YYYY format
CREATE OR REPLACE FUNCTION parse_date_mmddyyyy(date_string TEXT)
RETURNS DATE AS $$
BEGIN
    IF date_string IS NULL OR TRIM(date_string) = '' THEN
        RETURN NULL;
    END IF;
    
    -- Handle MM/DD/YYYY format
    RETURN TO_DATE(date_string, 'MM/DD/YYYY');
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to safely convert text to integer
CREATE OR REPLACE FUNCTION safe_to_integer(input_text TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF input_text IS NULL OR TRIM(input_text) = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN input_text::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to safely convert text to decimal
CREATE OR REPLACE FUNCTION safe_to_decimal(input_text TEXT)
RETURNS DECIMAL AS $$
BEGIN
    IF input_text IS NULL OR TRIM(input_text) = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN input_text::DECIMAL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA QUALITY CHECKS
-- ============================================================================

-- View to check data quality after import
CREATE OR REPLACE VIEW data_quality_report AS
SELECT 
    'Public Water Systems' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN pwsid IS NULL OR pwsid = '' THEN 1 END) as missing_pwsid,
    COUNT(CASE WHEN pws_name IS NULL OR pws_name = '' THEN 1 END) as missing_name,
    COUNT(CASE WHEN pws_type_code IS NULL THEN 1 END) as missing_type
FROM public_water_systems

UNION ALL

SELECT 
    'Violations',
    COUNT(*),
    COUNT(CASE WHEN pwsid IS NULL OR pwsid = '' THEN 1 END),
    COUNT(CASE WHEN violation_id IS NULL OR violation_id = '' THEN 1 END),
    COUNT(CASE WHEN violation_status IS NULL THEN 1 END)
FROM violations_enforcement

UNION ALL

SELECT 
    'Geographic Areas',
    COUNT(*),
    COUNT(CASE WHEN pwsid IS NULL OR pwsid = '' THEN 1 END),
    COUNT(CASE WHEN county_served IS NULL OR county_served = '' THEN 1 END),
    COUNT(CASE WHEN area_type_code IS NULL THEN 1 END)
FROM geographic_areas;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze tables for query optimization
-- (This will be run after data import)
-- ANALYZE public_water_systems;
-- ANALYZE violations_enforcement;
-- ANALYZE geographic_areas;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION clean_pwsid(TEXT) IS 'Standardizes PWSID format for consistent lookups';
COMMENT ON FUNCTION parse_date_mmddyyyy(TEXT) IS 'Safely converts MM/DD/YYYY date strings to DATE type';
COMMENT ON VIEW data_quality_report IS 'Reports data quality metrics after CSV import'; 