

-- Create a separate table for AI-generated violation explanations
-- This keeps the original data clean and allows for versioning

CREATE TABLE IF NOT EXISTS violation_ai_explanations (
    id BIGSERIAL PRIMARY KEY,
    submission_year_quarter VARCHAR(7) NOT NULL,
    violation_id VARCHAR(20) NOT NULL,
    pwsid VARCHAR(9) NOT NULL,
    
    -- AI-generated content
    explanation_text TEXT NOT NULL,
    health_risk_level VARCHAR(10) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    health_impact TEXT,
    recommended_actions TEXT,
    timeline_context TEXT,
    severity_score INTEGER CHECK (severity_score >= 1 AND severity_score <= 10),
    vulnerable_groups TEXT,
    contaminant_explanation TEXT,
    
    -- Metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_version VARCHAR(50) DEFAULT 'gpt-4o-mini-v1',
    regeneration_reason TEXT, -- Why this was regenerated (if applicable)
    is_current BOOLEAN DEFAULT TRUE, -- For versioning multiple explanations
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_violation_ai_explanations_violation 
        FOREIGN KEY (submission_year_quarter, pwsid, violation_id) 
        REFERENCES violations_enforcement(submission_year_quarter, pwsid, violation_id),
    
    -- Ensure only one current explanation per violation
    CONSTRAINT unique_current_explanation_per_violation 
        UNIQUE (submission_year_quarter, violation_id) DEFERRABLE INITIALLY DEFERRED
);

-- Add indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_violation_id ON violation_ai_explanations(violation_id);
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_pwsid ON violation_ai_explanations(pwsid);
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_health_risk ON violation_ai_explanations(health_risk_level);
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_severity ON violation_ai_explanations(severity_score);
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_current ON violation_ai_explanations(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_violation_ai_explanations_generated_at ON violation_ai_explanations(generated_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_violation_ai_explanations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_violation_ai_explanations_updated_at
    BEFORE UPDATE ON violation_ai_explanations
    FOR EACH ROW EXECUTE FUNCTION update_violation_ai_explanations_updated_at();

-- Create a comprehensive view for public consumption
CREATE OR REPLACE VIEW public_violation_explanations AS
SELECT 
    -- System info
    v.pwsid,
    p.pws_name,
    p.population_served_count,
    p.is_school_or_daycare_ind,
    
    -- Violation details
    v.violation_id,
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

-- Create a function to archive old explanations when creating new ones
CREATE OR REPLACE FUNCTION archive_old_explanations()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark old explanations as not current
    UPDATE violation_ai_explanations 
    SET is_current = FALSE, 
        updated_at = NOW()
    WHERE submission_year_quarter = NEW.submission_year_quarter
      AND violation_id = NEW.violation_id 
      AND id != NEW.id
      AND is_current = TRUE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_old_explanations
    AFTER INSERT ON violation_ai_explanations
    FOR EACH ROW EXECUTE FUNCTION archive_old_explanations();

-- Add table comments for documentation
COMMENT ON TABLE violation_ai_explanations IS 'AI-generated explanations for health-based water quality violations to help public understanding';
COMMENT ON COLUMN violation_ai_explanations.explanation_text IS 'Main AI-generated plain English explanation of the violation';
COMMENT ON COLUMN violation_ai_explanations.health_risk_level IS 'AI-assessed risk level: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN violation_ai_explanations.health_impact IS 'Specific health impacts and who is most at risk';
COMMENT ON COLUMN violation_ai_explanations.recommended_actions IS 'Consumer recommendations (filters, bottled water, etc.)';
COMMENT ON COLUMN violation_ai_explanations.timeline_context IS 'Context about violation duration and resolution progress';
COMMENT ON COLUMN violation_ai_explanations.severity_score IS 'Calculated severity from 1 (minor) to 10 (critical emergency)';
COMMENT ON COLUMN violation_ai_explanations.vulnerable_groups IS 'Groups most at risk (children, pregnant women, etc.)';
COMMENT ON COLUMN violation_ai_explanations.contaminant_explanation IS 'What the contaminant is and why it matters';
COMMENT ON COLUMN violation_ai_explanations.is_current IS 'Whether this is the current active explanation (supports versioning)';
COMMENT ON VIEW public_violation_explanations IS 'Complete public-facing view combining violation data with AI explanations'; 