---
name: Atelier Luxury Design System
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#735a30'
  on-secondary: '#ffffff'
  secondary-container: '#fddba6'
  on-secondary-container: '#785f34'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffdeab'
  secondary-fixed-dim: '#e3c28e'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#59431b'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 64px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  eyebrow-uppercase:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.15em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system embodies the "Private Fitting Room" concept, blending the high-fashion authority of editorial print with the effortless utility of modern D2C platforms. The personality is calm, intentional, and confident, prioritizing the garment as the focal point.

The style is **High-End Minimalism**. It utilizes expansive white space, thin 1px rules, and a sophisticated typographic hierarchy to create a sense of exclusivity. Visual clutter is eliminated to ensure the AI-driven virtual try-on feels like a premium service rather than a technical tool. The emotional response should be one of quiet luxury and personalized attention.

## Colors
The palette is rooted in a high-contrast monochromatic base, accented by champagne gold to signify value and interaction.

- **Primary (#0A0A0A):** Used for core branding, headlines, and primary action surfaces.
- **Champagne Gold (#C4A574):** Reserved for progress indicators, premium highlights, and subtle calls to action. It should be used sparingly to maintain its impact.
- **Surface Tiers:** Pure white (#FFFFFF) is the primary canvas. Soft Gray (#FAFAFA) is used for secondary containers or background sections to provide subtle depth without using shadows.
- **Typography:** Deep Black for readability and Muted Gray (#6B6B6B) for metadata, captions, and secondary information.

## Typography
The typographic strategy relies on the tension between the classic, literary feel of **EB Garamond** (serving as a proxy for Cormorant Garamond) and the systematic clarity of **Inter**.

- **Editorial Emphasis:** Use italicized EB Garamond for pull quotes or featured product names to evoke a fashion-magazine feel.
- **Information Architecture:** Use "Eyebrow-uppercase" for category labels above headlines to provide structure.
- **Scale:** On mobile, display sizes must scale aggressively to prevent horizontal overflow while maintaining the serif's elegance. 
- **Rhythm:** Wide tracking (letter-spacing) should only be applied to uppercase labels and buttons. Body copy should maintain standard tracking for optimal legibility.

## Layout & Spacing
The layout follows a **fluid grid** model with generous margins to enforce the "Atelier" atmosphere. 

- **Desktop:** A 12-column grid with 64px outer margins. Content should often be centered or offset to create an asymmetrical, editorial look.
- **Mobile:** A 4-column grid with 20px margins. 
- **Spacing Logic:** Use an 8px base unit. Vertical rhythm should be loose; use larger gaps (80px–120px) between major sections to allow the design to "breathe."
- **Horizontal Carousels:** Used for browsing collections or fabric swatches. On mobile, these should peek from the right edge to indicate scrollability without requiring visible scrollbars.

## Elevation & Depth
This design system rejects heavy shadows in favor of **Tonal Layers** and **1px Borders**.

- **Flat Hierarchy:** Depth is created by placing white cards on Soft Gray (#FAFAFA) backgrounds.
- **Borders:** Use 1px Solid (#E8E8E8) to define sections, image frames, and input fields.
- **Try-On Overlay:** The virtual try-on interface uses a full-screen state-driven modal. It should utilize a subtle backdrop blur (10px) to maintain the context of the shop while focusing the user's attention on the fitting room experience.
- **Shadows:** If used, they must be "Natural" (0px 4px 20px rgba(0,0,0,0.03)), appearing as subtle ambient light rather than structural depth.

## Shapes
The shape language is a mix of sharp architectural lines and organic "pill" softness.

- **Containers & Images:** Use sharp corners (0px) for product imagery and layout sections to maintain a rigid, editorial structure.
- **Interactive Elements:** Buttons, tags, and chips use a **Pill-shaped** (rounded-full) radius. This creates a clear distinction between content (sharp) and interaction (rounded), making the UI feel modern and approachable.
- **Input Fields:** These should remain sharp or slightly softened (4px) to align with the architectural grid.

## Components
- **Buttons:** Primary buttons are pill-shaped, solid black with white uppercase text (letter-spaced). Secondary buttons use 1px black borders with no fill.
- **Virtual Try-On Modal:** A sophisticated overlay featuring a split-screen view—the garment on the left and the AI-generated preview on the right. Controls are minimal, using Champagne Gold for active states.
- **Chips/Swatches:** Small pill-shaped containers for sizes; fabric swatches should be circular to contrast with the rectangular grid.
- **Input Fields:** Minimalist design—bottom border only (1px #E8E8E8) which turns Black (#0A0A0A) on focus. Labels use the "label-sm" style.
- **Cards:** Product cards are borderless with high-quality photography. The product name (EB Garamond) and price (Inter) appear below the image with generous top padding.
- **Loaders:** A custom champagne gold "thread" animation or a simple thin progress bar at the top of the viewport to signify AI processing.