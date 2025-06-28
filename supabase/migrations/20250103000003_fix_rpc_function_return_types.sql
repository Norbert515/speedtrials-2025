-- Fix RPC function return types to match the actual view column types
-- This fixes the "structure of query does not match function result type" error

-- Drop and recreate function with correct return types
DROP FUNCTION IF EXISTS get_violations_with_explanations(TEXT);

-- Function to get violations with explanations, with types matching the actual view
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
    viol_measure NUMERIC,  -- Changed from DECIMAL to NUMERIC
    unit_of_measure VARCHAR(9),
    explanation_text TEXT,
    health_risk_level VARCHAR(10),  -- Changed from TEXT to VARCHAR(10)
    severity_score INTEGER,
    pws_name VARCHAR(100),
    population_served_count INTEGER,
    county_served VARCHAR(40),
    city_served VARCHAR(40),
    -- Add missing AI explanation columns
    health_impact TEXT,
    recommended_actions TEXT,
    timeline_context TEXT,
    vulnerable_groups TEXT,
    contaminant_explanation TEXT,
    ai_generated_at TIMESTAMP WITH TIME ZONE,
    ai_model_version VARCHAR(50)
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
        pve.non_compl_per_begin_date,
        pve.non_compl_per_end_date,
        pve.public_notification_tier,
        pve.viol_measure,
        pve.unit_of_measure,
        pve.explanation_text,
        pve.health_risk_level,
        pve.severity_score,
        pve.pws_name,
        pve.population_served_count,
        pve.county_served,
        pve.city_served,
        pve.health_impact,
        pve.recommended_actions,
        pve.timeline_context,
        pve.vulnerable_groups,
        pve.contaminant_explanation,
        pve.ai_generated_at,
        pve.ai_model_version
    FROM public_violation_explanations pve
    WHERE pve.pwsid = system_pwsid
    ORDER BY 
        -- Sort by severity (higher scores first)
        COALESCE(pve.severity_score, 0) DESC,
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
            NULL::VARCHAR(10) as health_risk_level,
            NULL::INTEGER as severity_score,
            pws.pws_name,
            pws.population_served_count,
            geo.county_served,
            geo.city_served,
            -- Add missing AI explanation columns with NULL defaults
            NULL::TEXT as health_impact,
            NULL::TEXT as recommended_actions,
            NULL::TEXT as timeline_context,
            NULL::TEXT as vulnerable_groups,
            NULL::TEXT as contaminant_explanation,
            NULL::TIMESTAMP WITH TIME ZONE as ai_generated_at,
            NULL::VARCHAR(50) as ai_model_version
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

-- Add comment
COMMENT ON FUNCTION get_violations_with_explanations IS 'Get violations for a system with AI explanations, fallback to basic data if no explanations available - fixed types to match view'; 