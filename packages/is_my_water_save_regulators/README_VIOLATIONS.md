# 🚰 Violation UI System

This document explains the new violation display system that makes water quality violations easy to understand with AI explanations.

## 🎯 Problem Solved

**Before:** Violations were displayed as cryptic codes like "75", "2A", "MCL" that were impossible for the public to understand.

**After:** Violations now show:
- Plain English AI explanations 
- Health impact information
- Specific recommendations
- Visual risk indicators
- Clickable details

## 🏗️ Components

### 1. ViolationCard Component (`/src/components/ViolationCard.tsx`)

A reusable component that displays violations in user-friendly format with three size variants:

#### **Compact Size** - For lists and overview sections
```tsx
<ViolationCard 
  violation={violationData} 
  size="compact" 
  showExplanation={false} 
/>
```

#### **Normal Size** - Default with AI explanation preview
```tsx
<ViolationCard 
  violation={violationData} 
  size="normal" 
  showExplanation={true} 
/>
```

#### **Detailed Size** - Full information display
```tsx
<ViolationCard 
  violation={violationData} 
  size="detailed" 
  showExplanation={true} 
/>
```

### 2. Violation Detail Page (`/src/app/violations/[violationId]/page.tsx`)

A comprehensive page that shows everything about a specific violation:

- **AI Explanation** - Plain English description prominently featured
- **Health Impact** - Specific health risks and vulnerable groups
- **Recommended Actions** - What residents should do
- **Technical Details** - For those who want the specifics
- **Timeline** - When it started, how long it's been active
- **Context** - Population affected, location, notification tier

### 3. Enhanced System Detail Page

The system detail page now uses ViolationCard components instead of cryptic tables:

- Recent violations show as compact cards
- Full violations tab shows normal-sized cards with AI explanations
- All violations are clickable to view full details

## 🔗 Navigation Flow

1. **Dashboard** → Lists systems with health status
2. **System Detail** → Shows violations as easy-to-read cards
3. **Violation Detail** → Click any violation for full AI explanation

## 🤖 AI Explanations

The system uses the `public_violation_explanations` view which combines:

- **Technical Data** - Violation codes, measurements, dates
- **AI Content** - Plain English explanations, health impacts, recommendations
- **Risk Assessment** - Severity scores, risk levels, vulnerable groups

### AI Content Fields:

- `explanation_text` - Main plain English explanation
- `health_impact` - Specific health effects
- `recommended_actions` - What residents should do
- `timeline_context` - Duration and resolution info
- `vulnerable_groups` - Who is most at risk
- `contaminant_explanation` - What the contaminant is
- `health_risk_level` - LOW, MEDIUM, HIGH, CRITICAL
- `severity_score` - 1-10 calculated severity

## 🎨 Visual Design

### Status Indicators
- ✅ **Resolved** - Green checkmark
- ❌ **Unaddressed** - Red X (critical)
- ⏰ **Addressed** - Yellow clock (in progress)
- 🛡️ **Archived** - Gray shield (historical)

### Risk Level Colors
- 🔴 **CRITICAL** - Red background
- 🟠 **HIGH** - Orange background
- 🟡 **MEDIUM** - Yellow background  
- 🟢 **LOW** - Green background

### Health-Based Indicators
- ❤️ **Health-Based** - Red heart icon + "Health-Based" badge
- 📋 **Administrative** - Gray "Administrative" badge

## 🔍 Data Sources

The system intelligently handles data from multiple sources:

1. **Primary**: `public_violation_explanations` view (violations + AI)
2. **Fallback**: `violations_enforcement` table (basic violation data)
3. **Enhanced**: RPC functions for better sorting

### Database Functions

- `get_systems_sorted()` - Returns systems sorted worst-first
- `get_violations_with_explanations()` - Gets violations with AI explanations, fallback to basic data

## 🚀 Usage Examples

### Display Recent Violations
```tsx
{recentViolations.map((violation) => (
  <ViolationCard
    key={violation.violation_id}
    violation={violation as ViolationCardData}
    size="compact"
    showExplanation={false}
  />
))}
```

### Show All Violations with Explanations
```tsx
{violations.map((violation) => (
  <ViolationCard
    key={violation.violation_id}
    violation={violation as ViolationCardData}
    size="normal"
    showExplanation={true}
  />
))}
```

### Navigate to Violation Details
The ViolationCard component automatically handles navigation:
```tsx
// Clicking any ViolationCard navigates to:
// /violations/{violation_id}
```

## 🔮 Future Enhancements

1. **Filtering** - Filter by risk level, contaminant type, status
2. **Search** - Search violations by contaminant or description
3. **Alerts** - Subscribe to violation updates
4. **Export** - Export violation reports
5. **Maps** - Geographic visualization of violations
6. **Trends** - Show violation trends over time

## 📱 Mobile Responsive

All components are mobile-responsive:
- Cards stack vertically on mobile
- Text sizes adjust appropriately
- Touch-friendly click targets
- Readable on small screens

## ♿ Accessibility

- Semantic HTML structure
- ARIA labels for icons
- Color is not the only visual indicator
- Keyboard navigation support
- Screen reader friendly

## 🎯 Impact

This new system transforms water quality violations from:
- **Technical jargon** → **Plain English**
- **Confusing codes** → **Clear explanations** 
- **Static tables** → **Interactive cards**
- **Hidden details** → **Prominent health info**
- **Hard to understand** → **Actionable guidance**

The result is a public-friendly interface that helps residents understand their water quality and take appropriate action. 