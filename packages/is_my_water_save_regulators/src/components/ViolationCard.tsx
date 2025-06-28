"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Clock,
  Heart,
  Info,
  Calendar,
  Users,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface ViolationCardData {
  violation_id: string;
  pwsid: string;
  violation_code: string;
  violation_description?: string;
  violation_status: string;
  is_health_based_ind: string;
  contaminant_code?: string;
  contaminant_description?: string;
  non_compl_per_begin_date: string;
  non_compl_per_end_date?: string;
  public_notification_tier?: number;
  viol_measure?: number;
  unit_of_measure?: string;
  explanation_text?: string;
  health_risk_level?: string;
  severity_score?: number;
  pws_name?: string;
  population_served_count?: number;
  county_served?: string;
  city_served?: string;
}

interface ViolationCardProps {
  violation: ViolationCardData;
  size?: "compact" | "normal" | "detailed";
  showExplanation?: boolean;
  className?: string;
}

export function ViolationCard({
  violation,
  size = "normal",
  showExplanation = true,
  className = "",
}: ViolationCardProps) {
  const router = useRouter();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Resolved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Unaddressed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "Addressed":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "Archived":
        return <Info className="h-4 w-4 text-gray-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "text-green-600";
      case "Unaddressed":
        return "text-red-600";
      case "Addressed":
        return "text-yellow-600";
      case "Archived":
        return "text-gray-600";
      default:
        return "text-blue-600";
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

  const getHealthBasedBadge = () => {
    if (violation.is_health_based_ind === "Y") {
      const tier = violation.public_notification_tier;
      return (
        <Badge
          variant={tier === 1 ? "destructive" : "default"}
          className="flex items-center space-x-1"
        >
          <Heart className="h-3 w-3" />
          <span>Health-Based</span>
        </Badge>
      );
    }
    return <Badge variant="secondary">Administrative</Badge>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getDaysActive = () => {
    if (!violation.non_compl_per_begin_date) return null;
    const startDate = new Date(violation.non_compl_per_begin_date);
    const endDate = violation.non_compl_per_end_date
      ? new Date(violation.non_compl_per_end_date)
      : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleClick = () => {
    router.push(
      `/systems/${violation.pwsid}/violations/${violation.violation_id}`
    );
  };

  const daysActive = getDaysActive();

  if (size === "compact") {
    return (
      <div
        className={`p-3 border rounded-lg hover:shadow-md transition-all cursor-pointer hover:border-blue-300 ${className}`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(violation.violation_status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="space-y-1">
                <p className="font-medium text-sm leading-tight">
                  {violation.violation_description || violation.violation_code}
                </p>
                <div className="flex items-center space-x-2">
                  {getHealthBasedBadge()}
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  {formatDate(violation.non_compl_per_begin_date)}
                  {violation.contaminant_description &&
                    ` • ${violation.contaminant_description}`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
            {violation.health_risk_level && (
              <Badge
                className={`text-xs ${getRiskLevelColor(violation.health_risk_level)}`}
              >
                {violation.health_risk_level}
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      </div>
    );
  }

  if (size === "detailed") {
    return (
      <Card
        className={`hover:shadow-lg transition-all cursor-pointer hover:border-blue-300 ${className}`}
        onClick={handleClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>
                  {violation.violation_description || violation.violation_code}
                </span>
                {violation.is_health_based_ind === "Y" && (
                  <Heart className="h-4 w-4 text-red-500" />
                )}
              </CardTitle>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Violation ID: {violation.violation_id}</span>
                <span>•</span>
                <span>{formatDate(violation.non_compl_per_begin_date)}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(violation.violation_status)}
              <span
                className={`text-sm font-medium ${getStatusColor(violation.violation_status)}`}
              >
                {violation.violation_status}
              </span>
            </div>
          </div>
          {violation.health_risk_level && (
            <Badge
              className={`w-fit ${getRiskLevelColor(violation.health_risk_level)}`}
            >
              {violation.health_risk_level} Risk
              {violation.severity_score && ` (${violation.severity_score}/10)`}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* AI Explanation */}
          {showExplanation && violation.explanation_text && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-700">
                  AI Explanation
                </span>
                <Badge
                  variant="outline"
                  className="text-xs bg-gray-100 text-gray-600"
                >
                  AI Generated
                </Badge>
              </div>
              <p className="text-sm text-gray-900 leading-relaxed">
                {violation.explanation_text.length > 200
                  ? `${violation.explanation_text.substring(0, 200)}...`
                  : violation.explanation_text}
              </p>
            </div>
          )}

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {violation.contaminant_description && (
              <div>
                <p className="text-gray-600">Contaminant</p>
                <p className="font-medium">
                  {violation.contaminant_description}
                </p>
              </div>
            )}
            {violation.viol_measure && (
              <div>
                <p className="text-gray-600">Level Detected</p>
                <p className="font-medium">
                  {violation.viol_measure} {violation.unit_of_measure}
                </p>
              </div>
            )}
            {violation.public_notification_tier && (
              <div>
                <p className="text-gray-600">Notification Tier</p>
                <p className="font-medium">
                  Tier {violation.public_notification_tier}
                </p>
              </div>
            )}
            {daysActive && (
              <div>
                <p className="text-gray-600">Duration</p>
                <p className="font-medium">{daysActive} days</p>
              </div>
            )}
          </div>

          {/* System Info */}
          {(violation.pws_name ||
            violation.population_served_count ||
            violation.county_served) && (
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  {violation.pws_name && (
                    <div className="flex items-center space-x-1">
                      <Info className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-600">
                        {violation.pws_name}
                      </span>
                    </div>
                  )}
                  {violation.population_served_count && (
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-600">
                        {formatNumber(violation.population_served_count)} people
                      </span>
                    </div>
                  )}
                  {violation.county_served && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-600">
                        {violation.county_served} County
                      </span>
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Normal size (default)
  return (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer hover:border-blue-300 ${className}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center space-x-3">
              {getStatusIcon(violation.violation_status)}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <p className="font-medium">
                    {violation.violation_description ||
                      violation.violation_code}
                  </p>
                  {getHealthBasedBadge()}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(violation.non_compl_per_begin_date)}
                    </span>
                  </div>
                  {violation.contaminant_description && (
                    <span>{violation.contaminant_description}</span>
                  )}
                  {violation.viol_measure && (
                    <span>
                      {violation.viol_measure} {violation.unit_of_measure}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Show AI explanation preview for normal size */}
            {showExplanation && violation.explanation_text && (
              <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-700">
                    AI Explanation
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs bg-gray-100 text-gray-600"
                  >
                    AI Generated
                  </Badge>
                </div>
                <p className="text-gray-900">
                  {violation.explanation_text.length > 100
                    ? `${violation.explanation_text.substring(0, 100)}...`
                    : violation.explanation_text}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end space-y-2 ml-4">
            {violation.health_risk_level && (
              <Badge className={getRiskLevelColor(violation.health_risk_level)}>
                {violation.health_risk_level}
              </Badge>
            )}
            {violation.severity_score && (
              <Badge variant="outline">{violation.severity_score}/10</Badge>
            )}
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
