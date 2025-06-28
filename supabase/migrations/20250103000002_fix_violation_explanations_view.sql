-- Fix public_violation_explanations view to include missing columns
-- This fixes the "column pve.violation_code does not exist" error

-- Drop and recreate the view with all necessary columns
DROP VIEW IF EXISTS public_violation_explanations;

CREATE OR REPLACE VIEW public_violation_explanations AS
SELECT 
    -- System info
    v.pwsid,
    p.pws_name,
    p.population_served_count,
    p.is_school_or_daycare_ind,
    
    -- Violation details (including missing columns)
    v.violation_id,
    v.violation_code,  -- This was missing!
    v.is_health_based_ind,  -- This was missing!
    v.non_compl_per_begin_date,
    v.non_compl_per_end_date,
    v.violation_status,
    v.contaminant_code,
    v.viol_measure,
    v.unit_of_measure,
    v.federal_mcl,
    v.state_mcl,
    v.public_notification_tier,
    v.calculated_pub_notif_tier,
    
    -- Reference descriptions
    rc_violation.value_description as violation_description,
    rc_contaminant.value_description as contaminant_description,
    
    -- AI explanations
    ai.explanation_text,
    ai.health_risk_level,
    ai.health_impact,
    ai.recommended_actions,
    ai.timeline_context,
    ai.severity_score,
    ai.vulnerable_groups,
    ai.contaminant_explanation,
    ai.generated_at as ai_generated_at,
    ai.model_version as ai_model_version,
    
    -- Geographic info
    geo.county_served,
    geo.city_served,
    geo.zip_code_served
    
FROM violations_enforcement v
JOIN violation_ai_explanations ai ON v.submission_year_quarter = ai.submission_year_quarter 
    AND v.violation_id = ai.violation_id AND ai.is_current = TRUE
JOIN public_water_systems p ON v.pwsid = p.pwsid
LEFT JOIN reference_codes rc_violation ON rc_violation.value_type = 'VIOLATION_CODE' AND rc_violation.value_code = v.violation_code
LEFT JOIN reference_codes rc_contaminant ON rc_contaminant.value_type = 'CONTAMINANT_CODE' AND rc_contaminant.value_code = v.contaminant_code
LEFT JOIN geographic_areas geo ON v.pwsid = geo.pwsid AND geo.area_type_code = 'CN' -- County level
WHERE v.is_health_based_ind = 'Y'
ORDER BY ai.severity_score DESC, v.non_compl_per_begin_date DESC;

-- Update comment
COMMENT ON VIEW public_violation_explanations IS 'Complete public-facing view combining violation data with AI explanations - includes violation_code and is_health_based_ind'; 