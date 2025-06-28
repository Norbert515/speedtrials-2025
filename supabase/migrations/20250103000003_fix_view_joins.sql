-- Fix database views to properly join tables and show violations data
-- This addresses the issue where violations weren't showing up in the app

-- Current violations summary by system
CREATE OR REPLACE VIEW current_violations_summary AS
SELECT 
    p.pwsid,
    p.pws_name,
    p.pws_type_code,
    p.population_served_count,
    p.state_code,
    COUNT(v.violation_id) as total_violations,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) as health_violations,
    COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) as unaddressed_violations,
    COUNT(CASE WHEN v.violation_status = 'Resolved' THEN 1 END) as resolved_violations,
    MAX(v.non_compl_per_begin_date) as latest_violation_date
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
GROUP BY p.pwsid, p.pws_name, p.pws_type_code, p.population_served_count, p.state_code;

-- System health dashboard view
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT 
    p.pwsid,
    p.pws_name,
    p.pws_type_code,
    p.population_served_count,
    g.county_served,
    g.city_served,
    CASE 
        WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) > 0 THEN 'RED'
        WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) > 0 THEN 'YELLOW'
        ELSE 'GREEN'
    END as health_status,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) as total_unaddressed
FROM public_water_systems p
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
LEFT JOIN geographic_areas g ON p.pwsid = g.pwsid AND p.submission_year_quarter = g.submission_year_quarter AND g.area_type_code = 'CN'
WHERE p.pws_activity_code = 'A'
GROUP BY p.pwsid, p.pws_name, p.pws_type_code, p.population_served_count, g.county_served, g.city_served;

-- County-level summary for geographic visualizations
CREATE OR REPLACE VIEW county_summary AS
SELECT 
    g.county_served,
    g.state_served,
    COUNT(DISTINCT p.pwsid) as total_systems,
    SUM(p.population_served_count) as total_population,
    COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) as critical_violations,
    COUNT(v.violation_id) as total_violations
FROM geographic_areas g
JOIN public_water_systems p ON g.pwsid = p.pwsid AND g.submission_year_quarter = p.submission_year_quarter
LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid AND p.submission_year_quarter = v.submission_year_quarter
WHERE g.area_type_code = 'CN'
GROUP BY g.county_served, g.state_served;

COMMENT ON VIEW system_health_dashboard IS 'Fixed view to properly join water systems with violations and geographic data';
COMMENT ON VIEW current_violations_summary IS 'Fixed view with proper join conditions for violations data';
COMMENT ON VIEW county_summary IS 'Fixed county summary view with correct table joins'; 