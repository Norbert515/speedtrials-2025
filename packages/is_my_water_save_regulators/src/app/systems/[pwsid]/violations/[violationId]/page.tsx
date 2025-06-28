"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  AlertTriangle,
  Users,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Heart,
  Shield,
  Lightbulb,
  AlertOctagon,
  Home,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Type for violations returned from RPC function (updated to match new return structure)
interface ViolationFromRPC {
  violation_id: string;
  violation_code: string;
  violation_description: string | null;
  violation_status: string;
  is_health_based_ind: string;
  contaminant_code: string | null;
  contaminant_description: string | null;
  non_compl_per_begin_date: string;
  non_compl_per_end_date: string | null;
  public_notification_tier: number | null;
  viol_measure: number | null;
  unit_of_measure: string | null;
  explanation_text: string | null;
  health_risk_level: string | null;
  severity_score: number | null;
  pws_name: string;
  population_served_count: number;
  county_served: string | null;
  city_served: string | null;
  health_impact: string | null;
  recommended_actions: string | null;
  timeline_context: string | null;
  vulnerable_groups: string | null;
  contaminant_explanation: string | null;
  ai_generated_at: string | null;
  ai_model_version: string | null;
}

interface ViolationDetail {
  // Basic violation info
  violation_id: string;
  submission_year_quarter: string;
  pwsid: string;

  // System info
  pws_name: string;
  population_served_count: number;
  is_school_or_daycare_ind: string;

  // Violation details
  violation_code: string;
  violation_description: string;
  violation_category_code: string;
  violation_status: string;
  is_health_based_ind: string;
  contaminant_code: string;
  contaminant_description: string;

  // Measurements
  viol_measure: number;
  unit_of_measure: string;
  federal_mcl: string;
  state_mcl: number;

  // Dates
  non_compl_per_begin_date: string;
  non_compl_per_end_date: string;

  // Notification
  public_notification_tier: number;
  calculated_pub_notif_tier: number;

  // AI Explanations
  explanation_text: string;
  health_risk_level: string;
  health_impact: string;
  recommended_actions: string;
  timeline_context: string;
  severity_score: number;
  vulnerable_groups: string;
  contaminant_explanation: string;
  ai_generated_at: string;
  ai_model_version: string;

  // Geographic info
  county_served: string;
  city_served: string;
  zip_code_served: string;
}

export default function ViolationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const violationId = params.violationId as string;
  const pwsid = params.pwsid as string;

  // Get initial tab from URL or default to "overview"
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams?.get("tab") || "overview";
  });

  const [violation, setViolation] = useState<ViolationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to handle tab changes and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    // Update URL with new tab selection
    const params = new URLSearchParams(searchParams || "");
    params.set("tab", value);
    router.replace(
      `/systems/${pwsid}/violations/${violationId}?${params.toString()}`,
      { scroll: false }
    );
  };

  useEffect(() => {
    if (violationId && pwsid) {
      fetchViolationDetails();
    }
  }, [violationId, pwsid]);

  const fetchViolationDetails = async () => {
    try {
      setLoading(true);

      // Use our RPC function to get violations with explanations for this system
      const { data: violations, error: violationsError } = await supabase.rpc(
        "get_violations_with_explanations",
        { system_pwsid: pwsid }
      );

      if (violationsError) {
        throw new Error(
          `Error fetching violations: ${violationsError.message}`
        );
      }

      // Find the specific violation we want
      const violationData = (violations as ViolationFromRPC[])?.find(
        (v: ViolationFromRPC) => v.violation_id === violationId
      );

      if (!violationData) {
        throw new Error(`Violation ${violationId} not found in system data`);
      }

      // Add any missing fields with defaults
      const completeViolationData = {
        ...violationData,
        pwsid: pwsid, // Add the pwsid from URL parameter
        violation_description:
          violationData.violation_description ||
          `Violation ${violationData.violation_code}`,
        contaminant_description:
          violationData.contaminant_description ||
          violationData.contaminant_code ||
          "",
        explanation_text: violationData.explanation_text || "",
        health_risk_level: violationData.health_risk_level || "",
        health_impact: violationData.health_impact || "",
        recommended_actions: violationData.recommended_actions || "",
        timeline_context: violationData.timeline_context || "",
        vulnerable_groups: violationData.vulnerable_groups || "",
        contaminant_explanation: violationData.contaminant_explanation || "",
        ai_generated_at: violationData.ai_generated_at || "",
        ai_model_version: violationData.ai_model_version || "",
        is_school_or_daycare_ind: "N", // Default since we don't have this in the RPC function
        zip_code_served: "", // Default since we don't have this in the RPC function
        submission_year_quarter: "", // Default
        violation_category_code: "", // Default
        federal_mcl: "", // Default
        state_mcl: 0, // Default
        calculated_pub_notif_tier: violationData.public_notification_tier || 0, // Default
      };

      setViolation(completeViolationData as ViolationDetail);
    } catch (error) {
      console.error("Error fetching violation details:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load violation details"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Resolved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "Unaddressed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "Addressed":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "Archived":
        return <Shield className="h-5 w-5 text-gray-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-red-500 text-white";
      case "HIGH":
        return "bg-orange-500 text-white";
      case "MEDIUM":
        return "bg-yellow-500 text-white";
      case "LOW":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getDaysActive = () => {
    if (!violation?.non_compl_per_begin_date) return null;
    const startDate = new Date(violation.non_compl_per_begin_date);
    const endDate = violation.non_compl_per_end_date
      ? new Date(violation.non_compl_per_end_date)
      : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !violation) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  Violation Not Found
                </h2>
                <p className="text-gray-600">
                  {error || `Violation ${violationId} could not be found.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const daysActive = getDaysActive();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <button
              onClick={() => router.push("/")}
              className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <span>/</span>
            <button
              onClick={() => router.push(`/systems/${violation.pwsid}`)}
              className="hover:text-blue-600 transition-colors"
            >
              {violation.pws_name}
            </button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Violation Details</span>
          </nav>

          {/* Violation Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {violation.violation_description ||
                    `Violation ${violation.violation_code}`}
                </h1>
                {violation.is_health_based_ind === "Y" && (
                  <Heart className="h-6 w-6 text-red-500" />
                )}
              </div>
              <p className="text-gray-600">
                Violation ID: {violation.violation_id} • {violation.pws_name}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {getStatusIcon(violation.violation_status)}
              <div className="text-right">
                <div className="text-sm font-medium">
                  {violation.violation_status}
                </div>
                {violation.health_risk_level && (
                  <Badge
                    className={`mt-1 ${getRiskLevelColor(violation.health_risk_level)}`}
                  >
                    {violation.health_risk_level} Risk
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Explanation Alert - Most Important Info First */}
        {violation.explanation_text ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <span>What This Means</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs bg-gray-100 text-gray-600"
                >
                  AI Generated
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-900 leading-relaxed">
                {violation.explanation_text}
              </p>
              {violation.severity_score && (
                <div className="mt-4 flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Severity Score:</span>
                  <Badge variant="outline">{violation.severity_score}/10</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-yellow-600" />
                <span>Violation Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-900 leading-relaxed">
                This is a{" "}
                {violation.is_health_based_ind === "Y"
                  ? "health-based"
                  : "administrative"}{" "}
                violation.
                {violation.is_health_based_ind === "Y" && (
                  <span className="text-red-600 font-medium">
                    {" "}
                    Health-based violations may affect the safety of your
                    drinking water.
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                For detailed information about this violation, contact your
                water system or local health department.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Key Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                People Affected
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(violation.population_served_count || 0)}
              </div>
              <p className="text-xs text-gray-600">
                {violation.is_school_or_daycare_ind === "Y"
                  ? "School/Daycare System"
                  : "Community served"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Notification Tier
              </CardTitle>
              <AlertOctagon className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Tier {violation.public_notification_tier}
              </div>
              <p className="text-xs text-gray-600">
                {violation.public_notification_tier === 1
                  ? "Emergency (24hr)"
                  : violation.public_notification_tier === 2
                    ? "ASAP"
                    : "Annual notice"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {daysActive ? `${daysActive} days` : "Unknown"}
              </div>
              <p className="text-xs text-gray-600">
                {violation.violation_status === "Resolved"
                  ? "Was active for"
                  : "Currently active"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Location</CardTitle>
              <MapPin className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {violation.county_served || "Unknown"}
              </div>
              <p className="text-xs text-gray-600">
                {violation.city_served
                  ? `${violation.city_served}, GA`
                  : "Georgia"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Health Impact</TabsTrigger>
            <TabsTrigger value="actions">Recommended Actions</TabsTrigger>
            <TabsTrigger value="technical">Technical Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full mt-1"></div>
                      <div>
                        <p className="font-medium">Violation Began</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(violation.non_compl_per_begin_date)}
                        </p>
                      </div>
                    </div>
                    {violation.non_compl_per_end_date && (
                      <div className="flex items-start space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full mt-1"></div>
                        <div>
                          <p className="font-medium">Violation Resolved</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(violation.non_compl_per_end_date)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {violation.timeline_context && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <p className="text-sm">{violation.timeline_context}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contaminant Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Contaminant Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium text-lg">
                      {violation.contaminant_description ||
                        violation.contaminant_code ||
                        "Unknown"}
                    </p>
                    {violation.viol_measure && (
                      <p className="text-sm text-gray-600 mt-1">
                        Detected Level:{" "}
                        <span className="font-medium">
                          {violation.viol_measure} {violation.unit_of_measure}
                        </span>
                      </p>
                    )}
                    {violation.federal_mcl && (
                      <p className="text-sm text-gray-600">
                        Safety Limit:{" "}
                        <span className="font-medium">
                          {violation.federal_mcl}
                        </span>
                      </p>
                    )}
                  </div>
                  {violation.contaminant_explanation && (
                    <div className="p-3 bg-blue-50 rounded">
                      <p className="text-sm">
                        {violation.contaminant_explanation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span>Health Impact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {violation.health_impact ? (
                  <div className="prose max-w-none">
                    <p className="text-gray-900 leading-relaxed">
                      {violation.health_impact}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-600 italic">
                    No specific health impact information available.
                  </p>
                )}

                {violation.vulnerable_groups && (
                  <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded">
                    <h4 className="font-semibold text-orange-900 mb-2">
                      Most At Risk
                    </h4>
                    <p className="text-orange-800">
                      {violation.vulnerable_groups}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span>What You Should Do</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {violation.recommended_actions ? (
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-line text-gray-900 leading-relaxed">
                      {violation.recommended_actions}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-600">
                      {violation.is_health_based_ind === "Y"
                        ? "General recommendations for health-based violations:"
                        : "General recommendations:"}
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-900">
                      <li>
                        Contact your water system directly for specific
                        information about this violation
                      </li>
                      {violation.is_health_based_ind === "Y" && (
                        <>
                          <li className="text-red-600 font-medium">
                            Consider using bottled water for drinking and
                            cooking until the violation is resolved
                          </li>
                          <li className="text-red-600 font-medium">
                            Consult with your healthcare provider if you have
                            health concerns
                          </li>
                        </>
                      )}
                      <li>
                        Follow any public notifications from your water system
                      </li>
                      <li>Monitor updates on the violation status</li>
                      {violation.public_notification_tier === 1 && (
                        <li className="text-red-600 font-bold">
                          This is a Tier 1 emergency violation - take immediate
                          action
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Technical Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">
                        Violation Code
                      </span>
                      <p className="font-medium">{violation.violation_code}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Category</span>
                      <p className="font-medium">
                        {violation.violation_category_code}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Contaminant Code
                      </span>
                      <p className="font-medium">
                        {violation.contaminant_code || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Public Notification Tier
                      </span>
                      <p className="font-medium">
                        Tier {violation.public_notification_tier}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">
                        Water System ID
                      </span>
                      <p className="font-medium font-mono">{violation.pwsid}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Submission Quarter
                      </span>
                      <p className="font-medium">
                        {violation.submission_year_quarter}
                      </p>
                    </div>
                    {violation.federal_mcl && (
                      <div>
                        <span className="text-sm text-gray-600">
                          Federal MCL
                        </span>
                        <p className="font-medium">{violation.federal_mcl}</p>
                      </div>
                    )}
                    {violation.state_mcl && (
                      <div>
                        <span className="text-sm text-gray-600">State MCL</span>
                        <p className="font-medium">{violation.state_mcl}</p>
                      </div>
                    )}
                  </div>
                </div>

                {violation.ai_generated_at && violation.explanation_text && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      AI explanation generated on{" "}
                      {formatDate(violation.ai_generated_at)}
                      {violation.ai_model_version &&
                        ` using ${violation.ai_model_version}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
