# Fontshare Design System Implementation Guide

Generated: 2025-08-30 23:36:50

## Overview

This guide provides implementation details for recreating the Fontshare design system.

## Color Palette

### Background Colors
- **background-1**: `rgb(255, 255, 227)` - Background color
- **background-2**: `rgb(16, 16, 14)` - Background color
- **background-3**: `rgb(25, 24, 21)` - Background color
- **background-4**: `rgb(232, 232, 207)` - Background color
- **background-5**: `rgb(48, 48, 43)` - Background color
- **background-6**: `rgb(255, 241, 181)` - Background color
- **background-7**: `rgb(255, 207, 207)` - Background color
- **background-8**: `rgb(196, 253, 199)` - Background color
- **background-9**: `rgb(186, 251, 255)` - Background color
- **background-10**: `rgb(255, 255, 255)` - Background color

### Text Colors
- **text-1**: `rgb(0, 0, 0)` - Text color
- **text-2**: `rgb(255, 255, 227)` - Text color
- **text-3**: `rgb(16, 16, 14)` - Text color
- **text-4**: `rgb(96, 96, 85)` - Text color
- **text-5**: `rgb(48, 48, 43)` - Text color
- **text-6**: `rgb(232, 232, 207)` - Text color

## Typography

### Font Families
- **Passenger-Sans** (serif)
  - Stack: `Passenger-Sans, sans-serif`
  - Usage: general
- **_Satoshi_Variable** (sans-serif)
  - Stack: `_Satoshi_Variable`
  - Usage: general
- **_Clash_Display_Variable** (sans-serif)
  - Stack: `_Clash_Display_Variable`
  - Usage: general

### Type Scale
| Element | Size | Line Height | Weight |
|---------|------|-------------|--------|
| div | 120px | 144px | 400 |
| div | 64px | 72px | 600 |
| div | 24px | 29px | 500 |
| div | 16px | 19px | 400 |
| a | 16px | 19px | 500 |
| div | 14px | 14px | 500 |
| span | 12px | 14px | 500 |
| div | 12px | 14px | 400 |
| span | 12px | 14px | 700 |

## Spacing System

Base unit: 8px

### Spacing Scale
- Level 1: `-40px`
- Level 2: `-26px`
- Level 3: `-20px`
- Level 4: `-15px`
- Level 5: `-10px`
- Level 6: `-6px`
- Level 7: `-5px`
- Level 8: `-2px`
- Level 9: `-1px`
- Level 10: `1px`
- Level 11: `2px`
- Level 12: `4.0505px`
- Level 13: `5px`
- Level 14: `6px`
- Level 15: `10px`
- Level 16: `15px`
- Level 17: `20px`
- Level 18: `25px`
- Level 19: `40px`
- Level 20: `60px`
- Level 21: `75px`
- Level 22: `80px`
- Level 23: `100px`
- Level 24: `normal 20px`

## Layout Patterns


## Component Specifications

### KJUXdvtG -CLmIQPi (navigation)
Selector: `header.KJUXdvtG.-CLmIQPi`

**Properties:**
- backgroundColor: `rgba(0, 0, 0, 0)`
- padding: `0px 20px`
- position: `relative`
- display: `grid`
- justifyContent: `normal`
- alignItems: `normal`


## Responsive Breakpoints

- **xs**: min-width: `0px`, max-width: `639px`
- **sm**: min-width: `640px`, max-width: `767px`
- **md**: min-width: `768px`, max-width: `1023px`
- **lg**: min-width: `1024px`, max-width: `1279px`
- **xl**: min-width: `1280px`, max-width: `1535px`
- **2xl**: min-width: `1536px`

## Implementation Notes

1. **CSS Variables**: Use the generated `design-tokens.css` file for consistent theming
2. **Typography**: Implement the type scale using CSS classes or utility classes
3. **Spacing**: Use the spacing scale for consistent margins and paddings
4. **Components**: Follow the component specifications for consistent UI elements
5. **Responsive**: Implement breakpoints for mobile-first responsive design
