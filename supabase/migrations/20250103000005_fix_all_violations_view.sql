-- Fix violations view to show ALL violations with proper fallbacks
-- Migration: 20250103000004_fix_all_violations_view.sql

-- Create comprehensive view that shows ALL violations (not just health-based)
-- and handles violations without AI explanations
CREATE OR REPLACE VIEW public_violation_explanations AS
SELECT 
    -- System info
    v.pwsid,
    p.pws_name,
    p.population_served_count,
    p.is_school_or_daycare_ind,
    
    -- Violation details
    v.violation_id,
    v.violation_code,
    v.is_health_based_ind,
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
    v.violation_category_code,
    
    -- Reference descriptions
    rc_violation.value_description as violation_description,
    rc_contaminant.value_description as contaminant_description,
    
    -- AI explanations (nullable for violations without explanations)
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
-- LEFT JOIN so violations without AI explanations still appear
LEFT JOIN violation_ai_explanations ai ON v.submission_year_quarter = ai.submission_year_quarter 
    AND v.violation_id = ai.violation_id AND ai.is_current = TRUE
JOIN public_water_systems p ON v.pwsid = p.pwsid AND v.submission_year_quarter = p.submission_year_quarter
LEFT JOIN reference_codes rc_violation ON rc_violation.value_type = 'VIOLATION_CODE' AND rc_violation.value_code = v.violation_code
LEFT JOIN reference_codes rc_contaminant ON rc_contaminant.value_type = 'CONTAMINANT_CODE' AND rc_contaminant.value_code = v.contaminant_code
LEFT JOIN geographic_areas geo ON v.pwsid = geo.pwsid AND v.submission_year_quarter = geo.submission_year_quarter AND geo.area_type_code = 'CN'
-- REMOVED: WHERE v.is_health_based_ind = 'Y' -- Now shows ALL violations
ORDER BY 
    COALESCE(ai.severity_score, 
        CASE 
            WHEN v.is_health_based_ind = 'Y' AND v.violation_status = 'Unaddressed' THEN 8
            WHEN v.is_health_based_ind = 'Y' THEN 6
            WHEN v.violation_status = 'Unaddressed' THEN 4
            ELSE 2
        END
    ) DESC, 
    v.non_compl_per_begin_date DESC;

-- Create a view specifically for health-based violations (for existing queries)
CREATE OR REPLACE VIEW health_violation_explanations AS
SELECT * FROM public_violation_explanations
WHERE is_health_based_ind = 'Y';

-- Add comments
COMMENT ON VIEW public_violation_explanations IS 'Complete view of ALL violations with AI explanations where available - includes both health-based and non-health-based violations';
COMMENT ON VIEW health_violation_explanations IS 'Health-based violations only - for compatibility with existing queries'; 