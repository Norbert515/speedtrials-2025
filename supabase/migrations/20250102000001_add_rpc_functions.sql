-- ============================================================================
-- RPC FUNCTIONS FOR BETTER SORTING AND VIOLATION DISPLAY
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_systems_sorted(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_violations_with_explanations(TEXT);

-- Function to get systems sorted by health status (worst first)
CREATE OR REPLACE FUNCTION get_systems_sorted(
    page_offset INTEGER DEFAULT 0,
    page_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    pwsid VARCHAR(9),
    pws_name VARCHAR(100),
    pws_type_code VARCHAR(6),
    population_served_count INTEGER,
    county_served VARCHAR(40),
    city_served VARCHAR(40),
    health_status TEXT,
    critical_violations BIGINT,
    total_unaddressed BIGINT
) AS $$
BEGIN
    RETURN QUERY
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
    LEFT JOIN violations_enforcement v ON p.pwsid = v.pwsid
    LEFT JOIN geographic_areas g ON p.pwsid = g.pwsid AND g.area_type_code = 'CN'
    WHERE p.pws_activity_code = 'A'  -- Remove hardcoded quarter filter
    GROUP BY p.pwsid, p.pws_name, p.pws_type_code, p.population_served_count, g.county_served, g.city_served
    ORDER BY 
        -- Sort by health status (worst first)
        CASE 
            WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) > 0 THEN 1 
            WHEN COUNT(CASE WHEN v.is_health_based_ind = 'Y' THEN 1 END) > 0 THEN 2 
            ELSE 3 
        END,
        -- Within each status, sort by number of critical violations (descending)
        COUNT(CASE WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 1 END) DESC,
        -- Then by total unaddressed violations (descending)
        COUNT(CASE WHEN v.violation_status = 'Unaddressed' THEN 1 END) DESC,
        -- Finally by population served (larger systems first)
        p.population_served_count DESC
    OFFSET page_offset
    LIMIT page_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get violations with explanations, with better error handling
CREATE OR REPLACE FUNCTION get_violations_with_explanations(
    system_pwsid TEXT
)
RETURNS TABLE (
    violation_id VARCHAR(20),
    violation_code VARCHAR(4),
    violation_description TEXT,
    violation_status VARCHAR(11),
    is_health_based_ind VARCHAR(1),
    contaminant_code VARCHAR(4),
    contaminant_description TEXT,
    non_compl_per_begin_date DATE,
    non_compl_per_end_date DATE,
    public_notification_tier INTEGER,
    viol_measure DECIMAL,
    unit_of_measure VARCHAR(9),
    explanation_text TEXT,
    health_risk_level TEXT,
    severity_score INTEGER,
    pws_name VARCHAR(100),
    population_served_count INTEGER,
    county_served VARCHAR(40),
    city_served VARCHAR(40)
) AS $$
BEGIN
    -- Try to return violations with AI explanations
    RETURN QUERY
    SELECT 
        pve.violation_id,
        pve.violation_code,
        pve.violation_description,
        pve.violation_status,
        pve.is_health_based_ind,
        pve.contaminant_code,
        pve.contaminant_description,
        pve.non_compl_per_begin_date::DATE,
        pve.non_compl_per_end_date::DATE,
        pve.public_notification_tier,
        pve.viol_measure,
        pve.unit_of_measure,
        pve.explanation_text,
        pve.health_risk_level,
        pve.severity_score,
        pve.pws_name,
        pve.population_served_count,
        pve.county_served,
        pve.city_served
    FROM public_violation_explanations pve
    WHERE pve.pwsid = system_pwsid
    ORDER BY 
        -- Sort by severity (higher scores first)
        COALESCE(pve.severity_score, 0) DESC,
        -- Then by health-based status
        CASE WHEN pve.is_health_based_ind = 'Y' THEN 0 ELSE 1 END,
        -- Then by violation status priority
        CASE pve.violation_status 
            WHEN 'Unaddressed' THEN 1 
            WHEN 'Addressed' THEN 2
            WHEN 'Resolved' THEN 3
            WHEN 'Archived' THEN 4
            ELSE 5 
        END,
        -- Finally by date (most recent first)
        pve.non_compl_per_begin_date DESC;
    
    -- If no results with explanations, fall back to basic violation data
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            ve.violation_id,
            ve.violation_code,
            NULL::TEXT as violation_description,
            ve.violation_status,
            ve.is_health_based_ind,
            ve.contaminant_code,
            NULL::TEXT as contaminant_description,
            ve.non_compl_per_begin_date,
            ve.non_compl_per_end_date,
            ve.public_notification_tier,
            ve.viol_measure,
            ve.unit_of_measure,
            NULL::TEXT as explanation_text,
            NULL::TEXT as health_risk_level,
            NULL::INTEGER as severity_score,
            pws.pws_name,
            pws.population_served_count,
            geo.county_served,
            geo.city_served
        FROM violations_enforcement ve
        LEFT JOIN public_water_systems pws ON ve.pwsid = pws.pwsid
        LEFT JOIN geographic_areas geo ON ve.pwsid = geo.pwsid AND geo.area_type_code = 'CN'
        WHERE ve.pwsid = system_pwsid
        ORDER BY 
            -- Sort by health-based status
            CASE WHEN ve.is_health_based_ind = 'Y' THEN 0 ELSE 1 END,
            -- Then by violation status priority
            CASE ve.violation_status 
                WHEN 'Unaddressed' THEN 1 
                WHEN 'Addressed' THEN 2
                WHEN 'Resolved' THEN 3
                WHEN 'Archived' THEN 4
                ELSE 5 
            END,
            -- Finally by date (most recent first)
            ve.non_compl_per_begin_date DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment the functions
COMMENT ON FUNCTION get_systems_sorted IS 'Get water systems sorted by health status (worst first) with pagination';
COMMENT ON FUNCTION get_violations_with_explanations IS 'Get violations for a system with AI explanations, fallback to basic data if no explanations available'; 