package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/chromedp/chromedp"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// DesignSystem represents the complete design language of a website
type DesignSystem struct {
	URL          string                 `json:"url"`
	Domain       string                 `json:"domain"`
	Timestamp    string                 `json:"timestamp"`
	Colors       ColorPalette           `json:"colors"`
	Typography   TypographySystem       `json:"typography"`
	Spacing      SpacingSystem          `json:"spacing"`
	Layout       LayoutSystem           `json:"layout"`
	Components   []ComponentSpec        `json:"components"`
	Interactions InteractionPatterns    `json:"interactions"`
	Breakpoints  []ResponsiveBreakpoint `json:"breakpoints"`
	Assets       AssetStrategy          `json:"assets"`
}

// ColorPalette represents the color system
type ColorPalette struct {
	Primary     []ColorSpec `json:"primary"`
	Secondary   []ColorSpec `json:"secondary"`
	Neutral     []ColorSpec `json:"neutral"`
	Background  []ColorSpec `json:"background"`
	Text        []ColorSpec `json:"text"`
	Border      []ColorSpec `json:"border"`
	Accent      []ColorSpec `json:"accent"`
	Semantic    []ColorSpec `json:"semantic"` // success, warning, error, info
	Gradients   []string    `json:"gradients"`
	Shadows     []string    `json:"shadows"`
}

// ColorSpec represents a single color definition
type ColorSpec struct {
	Name     string `json:"name"`
	Value    string `json:"value"`    // hex, rgb, hsl
	Usage    string `json:"usage"`    // where/how it's used
	Contrast string `json:"contrast"` // WCAG contrast ratio if applicable
}

// TypographySystem represents font and text styling
type TypographySystem struct {
	FontFamilies []FontFamily     `json:"fontFamilies"`
	TypeScale    []TypeScaleLevel `json:"typeScale"`
	TextStyles   []TextStyle      `json:"textStyles"`
	LineHeights  map[string]string `json:"lineHeights"`
	LetterSpacing map[string]string `json:"letterSpacing"`
}

// FontFamily represents a font family definition
type FontFamily struct {
	Name      string   `json:"name"`
	Stack     string   `json:"stack"`     // full font stack
	Category  string   `json:"category"`  // serif, sans-serif, monospace, etc
	Weights   []string `json:"weights"`   // available weights
	Source    string   `json:"source"`    // local, google fonts, custom
	Usage     string   `json:"usage"`     // headings, body, code, etc
}

// TypeScaleLevel represents a level in the type scale
type TypeScaleLevel struct {
	Name       string `json:"name"`       // h1, h2, body, small, etc
	Size       string `json:"size"`       // font-size value
	LineHeight string `json:"lineHeight"` 
	Weight     string `json:"weight"`
	LetterSpacing string `json:"letterSpacing,omitempty"`
	TextTransform string `json:"textTransform,omitempty"`
}

// TextStyle represents a complete text style
type TextStyle struct {
	Name       string            `json:"name"`
	Selector   string            `json:"selector"`
	Properties map[string]string `json:"properties"`
}

// SpacingSystem represents spacing values
type SpacingSystem struct {
	BaseUnit  string            `json:"baseUnit"`  // e.g., "8px", "1rem"
	Scale     []string          `json:"scale"`     // spacing scale values
	Margins   map[string]string `json:"margins"`
	Paddings  map[string]string `json:"paddings"`
	Gaps      map[string]string `json:"gaps"`
}

// LayoutSystem represents layout patterns
type LayoutSystem struct {
	GridSystem    GridSpec          `json:"gridSystem"`
	MaxWidths     map[string]string `json:"maxWidths"`
	Containers    []ContainerSpec   `json:"containers"`
	FlexPatterns  []FlexPattern     `json:"flexPatterns"`
	GridPatterns  []GridPattern     `json:"gridPatterns"`
}

// GridSpec represents grid system configuration
type GridSpec struct {
	Columns    int               `json:"columns"`
	Gutter     string            `json:"gutter"`
	Margin     string            `json:"margin"`
	MaxWidth   string            `json:"maxWidth"`
	Breakpoints map[string]string `json:"breakpoints"`
}

// ContainerSpec represents a container element
type ContainerSpec struct {
	Name     string            `json:"name"`
	MaxWidth string            `json:"maxWidth"`
	Padding  string            `json:"padding"`
	Margin   string            `json:"margin"`
}

// FlexPattern represents a flexbox layout pattern
type FlexPattern struct {
	Name       string            `json:"name"`
	Properties map[string]string `json:"properties"`
	Usage      string            `json:"usage"`
}

// GridPattern represents a CSS grid layout pattern
type GridPattern struct {
	Name       string            `json:"name"`
	Properties map[string]string `json:"properties"`
	Usage      string            `json:"usage"`
}

// ComponentSpec represents a UI component specification
type ComponentSpec struct {
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // button, card, nav, form, etc
	Selector   string                 `json:"selector"`
	Properties map[string]string      `json:"properties"`
	States     map[string]StateStyle  `json:"states"` // hover, active, focus, disabled
	Variants   []ComponentVariant     `json:"variants"`
	Examples   []string               `json:"examples"` // HTML snippets
}

// StateStyle represents styles for a component state
type StateStyle struct {
	Properties map[string]string `json:"properties"`
	Transition string            `json:"transition,omitempty"`
}

// ComponentVariant represents a component variation
type ComponentVariant struct {
	Name       string            `json:"name"`
	Properties map[string]string `json:"properties"`
}

// InteractionPatterns represents interaction and animation patterns
type InteractionPatterns struct {
	Transitions []TransitionSpec `json:"transitions"`
	Animations  []AnimationSpec  `json:"animations"`
	Hovers      []HoverEffect    `json:"hovers"`
	Scrolling   ScrollBehavior   `json:"scrolling"`
}

// TransitionSpec represents a CSS transition
type TransitionSpec struct {
	Selector   string `json:"selector"`
	Property   string `json:"property"`
	Duration   string `json:"duration"`
	Timing     string `json:"timing"`
	Delay      string `json:"delay,omitempty"`
}

// AnimationSpec represents a CSS animation
type AnimationSpec struct {
	Name       string `json:"name"`
	Duration   string `json:"duration"`
	Timing     string `json:"timing"`
	Iterations string `json:"iterations"`
	Keyframes  string `json:"keyframes"`
}

// HoverEffect represents a hover interaction
type HoverEffect struct {
	Selector   string            `json:"selector"`
	Properties map[string]string `json:"properties"`
	Transition string            `json:"transition"`
}

// ScrollBehavior represents scroll-related behaviors
type ScrollBehavior struct {
	Smooth       bool   `json:"smooth"`
	ScrollSnap   string `json:"scrollSnap,omitempty"`
	ParallaxEffects []string `json:"parallaxEffects,omitempty"`
	StickyElements []string `json:"stickyElements,omitempty"`
}

// ResponsiveBreakpoint represents a responsive design breakpoint
type ResponsiveBreakpoint struct {
	Name      string `json:"name"`
	MinWidth  string `json:"minWidth"`
	MaxWidth  string `json:"maxWidth,omitempty"`
	Container string `json:"container,omitempty"`
}

// AssetStrategy represents how assets are handled
type AssetStrategy struct {
	Images     ImageStrategy     `json:"images"`
	Icons      IconStrategy      `json:"icons"`
	Fonts      FontLoadStrategy  `json:"fonts"`
}

// ImageStrategy represents image handling approach
type ImageStrategy struct {
	LazyLoading  bool     `json:"lazyLoading"`
	Formats      []string `json:"formats"`
	Optimization string   `json:"optimization"`
	Placeholders string   `json:"placeholders"`
}

// IconStrategy represents icon system
type IconStrategy struct {
	System    string   `json:"system"` // svg, font, sprite
	Library   string   `json:"library,omitempty"`
	CustomIcons []string `json:"customIcons,omitempty"`
}

// FontLoadStrategy represents font loading approach
type FontLoadStrategy struct {
	Strategy    string   `json:"strategy"` // swap, block, fallback, optional
	Preload     []string `json:"preload"`
	FontDisplay string   `json:"fontDisplay"`
}

// getFontshareAnalysisScript returns JavaScript to analyze Fontshare's design system
func getFontshareAnalysisScript() string {
	return `
(function() {
	console.log('🎨 Starting Fontshare design analysis...');
	
	const designSystem = {
		url: window.location.href,
		domain: window.location.hostname,
		timestamp: new Date().toISOString(),
		colors: {},
		typography: {},
		spacing: {},
		layout: {},
		components: [],
		interactions: {},
		breakpoints: [],
		assets: {}
	};
	
	// Utility function to get computed styles
	function getComputedStyles(element) {
		return window.getComputedStyle(element);
	}
	
	// Extract color from element
	function extractColor(element, property) {
		const value = getComputedStyles(element)[property];
		if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
			return value;
		}
		return null;
	}
	
	// Extract all colors from the page
	function extractColors() {
		const colors = {
			primary: [],
			secondary: [],
			neutral: [],
			background: new Set(),
			text: new Set(),
			border: new Set(),
			accent: [],
			semantic: [],
			gradients: new Set(),
			shadows: new Set()
		};
		
		// Get all elements
		const elements = document.querySelectorAll('*');
		
		elements.forEach(el => {
			const styles = getComputedStyles(el);
			
			// Background colors
			const bgColor = extractColor(el, 'backgroundColor');
			if (bgColor) colors.background.add(bgColor);
			
			// Text colors
			const textColor = extractColor(el, 'color');
			if (textColor) colors.text.add(textColor);
			
			// Border colors
			const borderColor = extractColor(el, 'borderColor');
			if (borderColor && borderColor !== textColor) colors.border.add(borderColor);
			
			// Gradients
			const bgImage = styles.backgroundImage;
			if (bgImage && bgImage.includes('gradient')) {
				colors.gradients.add(bgImage);
			}
			
			// Box shadows
			const boxShadow = styles.boxShadow;
			if (boxShadow && boxShadow !== 'none') {
				colors.shadows.add(boxShadow);
			}
		});
		
		// Convert sets to arrays with proper structure
		colors.background = Array.from(colors.background).map((value, index) => ({
			name: 'background-' + (index + 1),
			value: value,
			usage: 'Background color'
		}));
		
		colors.text = Array.from(colors.text).map((value, index) => ({
			name: 'text-' + (index + 1),
			value: value,
			usage: 'Text color'
		}));
		
		colors.border = Array.from(colors.border).map((value, index) => ({
			name: 'border-' + (index + 1),
			value: value,
			usage: 'Border color'
		}));
		
		colors.gradients = Array.from(colors.gradients);
		colors.shadows = Array.from(colors.shadows);
		
		// Look for semantic colors (buttons, alerts, etc)
		const buttons = document.querySelectorAll('button, .btn, [class*="button"]');
		const buttonColors = new Set();
		buttons.forEach(btn => {
			const bg = extractColor(btn, 'backgroundColor');
			if (bg) buttonColors.add(bg);
		});
		
		colors.primary = Array.from(buttonColors).map((value, index) => ({
			name: 'primary-' + (index + 1),
			value: value,
			usage: 'Primary action color'
		}));
		
		return colors;
	}
	
	// Extract typography information
	function extractTypography() {
		const typography = {
			fontFamilies: [],
			typeScale: [],
			textStyles: [],
			lineHeights: {},
			letterSpacing: {}
		};
		
		// Get unique font families
		const fontFamilies = new Set();
		const elements = document.querySelectorAll('*');
		
		elements.forEach(el => {
			const fontFamily = getComputedStyles(el).fontFamily;
			if (fontFamily) fontFamilies.add(fontFamily);
		});
		
		typography.fontFamilies = Array.from(fontFamilies).map(stack => {
			const name = stack.split(',')[0].replace(/['"]/g, '').trim();
			return {
				name: name,
				stack: stack,
				category: stack.includes('serif') ? 'serif' : 'sans-serif',
				weights: [],
				source: 'web',
				usage: 'general'
			};
		});
		
		// Extract type scale from headings and common text elements
		const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, a, button');
		const typeScales = new Map();
		
		textElements.forEach(el => {
			const styles = getComputedStyles(el);
			const fontSize = styles.fontSize;
			const lineHeight = styles.lineHeight;
			const fontWeight = styles.fontWeight;
			const letterSpacing = styles.letterSpacing;
			
			const key = fontSize + '-' + fontWeight;
			if (!typeScales.has(key)) {
				typeScales.set(key, {
					name: el.tagName.toLowerCase(),
					size: fontSize,
					lineHeight: lineHeight,
					weight: fontWeight,
					letterSpacing: letterSpacing !== 'normal' ? letterSpacing : undefined
				});
			}
		});
		
		typography.typeScale = Array.from(typeScales.values()).sort((a, b) => {
			return parseFloat(b.size) - parseFloat(a.size);
		});
		
		return typography;
	}
	
	// Extract spacing system
	function extractSpacing() {
		const spacing = {
			baseUnit: '8px',
			scale: [],
			margins: {},
			paddings: {},
			gaps: {}
		};
		
		const elements = document.querySelectorAll('*');
		const marginValues = new Set();
		const paddingValues = new Set();
		const gapValues = new Set();
		
		elements.forEach(el => {
			const styles = getComputedStyles(el);
			
			// Margins
			['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(prop => {
				const value = styles[prop];
				if (value && value !== '0px' && value !== 'auto') {
					marginValues.add(value);
				}
			});
			
			// Paddings
			['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(prop => {
				const value = styles[prop];
				if (value && value !== '0px') {
					paddingValues.add(value);
				}
			});
			
			// Gaps (for flex and grid)
			const gap = styles.gap;
			if (gap && gap !== '0px' && gap !== 'normal') {
				gapValues.add(gap);
			}
		});
		
		// Convert to arrays and sort
		spacing.scale = Array.from(new Set([...marginValues, ...paddingValues, ...gapValues]))
			.sort((a, b) => parseFloat(a) - parseFloat(b));
		
		// Create spacing maps
		Array.from(marginValues).forEach((value, index) => {
			spacing.margins['m-' + (index + 1)] = value;
		});
		
		Array.from(paddingValues).forEach((value, index) => {
			spacing.paddings['p-' + (index + 1)] = value;
		});
		
		Array.from(gapValues).forEach((value, index) => {
			spacing.gaps['gap-' + (index + 1)] = value;
		});
		
		return spacing;
	}
	
	// Extract layout patterns
	function extractLayout() {
		const layout = {
			gridSystem: {},
			maxWidths: {},
			containers: [],
			flexPatterns: [],
			gridPatterns: []
		};
		
		// Find containers
		const containers = document.querySelectorAll('[class*="container"], main, .wrapper, [class*="layout"]');
		containers.forEach(container => {
			const styles = getComputedStyles(container);
			if (styles.maxWidth && styles.maxWidth !== 'none') {
				layout.containers.push({
					name: container.className || container.tagName.toLowerCase(),
					maxWidth: styles.maxWidth,
					padding: styles.padding,
					margin: styles.margin
				});
			}
		});
		
		// Find flex layouts
		const flexElements = Array.from(document.querySelectorAll('*')).filter(el => {
			return getComputedStyles(el).display === 'flex';
		});
		
		flexElements.slice(0, 10).forEach(el => { // Limit to first 10 for brevity
			const styles = getComputedStyles(el);
			layout.flexPatterns.push({
				name: el.className || el.tagName.toLowerCase(),
				properties: {
					display: styles.display,
					flexDirection: styles.flexDirection,
					justifyContent: styles.justifyContent,
					alignItems: styles.alignItems,
					flexWrap: styles.flexWrap,
					gap: styles.gap
				},
				usage: 'Flex container'
			});
		});
		
		// Find grid layouts
		const gridElements = Array.from(document.querySelectorAll('*')).filter(el => {
			return getComputedStyles(el).display === 'grid';
		});
		
		gridElements.slice(0, 10).forEach(el => { // Limit to first 10 for brevity
			const styles = getComputedStyles(el);
			layout.gridPatterns.push({
				name: el.className || el.tagName.toLowerCase(),
				properties: {
					display: styles.display,
					gridTemplateColumns: styles.gridTemplateColumns,
					gridTemplateRows: styles.gridTemplateRows,
					gap: styles.gap,
					gridAutoFlow: styles.gridAutoFlow
				},
				usage: 'Grid container'
			});
		});
		
		return layout;
	}
	
	// Extract component specifications
	function extractComponents() {
		const components = [];
		
		// Extract button styles
		const buttons = document.querySelectorAll('button, .btn, [class*="button"], a[class*="btn"]');
		const buttonStyles = new Map();
		
		buttons.forEach(btn => {
			const styles = getComputedStyles(btn);
			const className = btn.className || 'default-button';
			
			if (!buttonStyles.has(className)) {
				const component = {
					name: className,
					type: 'button',
					selector: btn.tagName.toLowerCase() + (className ? '.' + className.split(' ').join('.') : ''),
					properties: {
						backgroundColor: styles.backgroundColor,
						color: styles.color,
						padding: styles.padding,
						margin: styles.margin,
						border: styles.border,
						borderRadius: styles.borderRadius,
						fontSize: styles.fontSize,
						fontWeight: styles.fontWeight,
						textTransform: styles.textTransform,
						cursor: styles.cursor,
						transition: styles.transition
					},
					states: {},
					variants: []
				};
				
				buttonStyles.set(className, component);
				components.push(component);
			}
		});
		
		// Extract card/panel styles
		const cards = document.querySelectorAll('[class*="card"], [class*="panel"], article');
		const cardStyles = new Map();
		
		cards.forEach(card => {
			const styles = getComputedStyles(card);
			const className = card.className || 'default-card';
			
			if (!cardStyles.has(className)) {
				components.push({
					name: className,
					type: 'card',
					selector: card.tagName.toLowerCase() + (className ? '.' + className.split(' ').join('.') : ''),
					properties: {
						backgroundColor: styles.backgroundColor,
						padding: styles.padding,
						margin: styles.margin,
						border: styles.border,
						borderRadius: styles.borderRadius,
						boxShadow: styles.boxShadow
					},
					states: {},
					variants: []
				});
				cardStyles.set(className, true);
			}
		});
		
		// Extract navigation styles
		const navs = document.querySelectorAll('nav, [class*="nav"], header');
		navs.forEach(nav => {
			const styles = getComputedStyles(nav);
			components.push({
				name: nav.className || 'navigation',
				type: 'navigation',
				selector: nav.tagName.toLowerCase() + (nav.className ? '.' + nav.className.split(' ').join('.') : ''),
				properties: {
					backgroundColor: styles.backgroundColor,
					padding: styles.padding,
					position: styles.position,
					display: styles.display,
					justifyContent: styles.justifyContent,
					alignItems: styles.alignItems
				},
				states: {},
				variants: []
			});
		});
		
		return components.slice(0, 20); // Limit to first 20 components
	}
	
	// Extract interaction patterns
	function extractInteractions() {
		const interactions = {
			transitions: [],
			animations: [],
			hovers: [],
			scrolling: {}
		};
		
		// Check for smooth scrolling
		const htmlStyles = getComputedStyles(document.documentElement);
		interactions.scrolling = {
			smooth: htmlStyles.scrollBehavior === 'smooth',
			scrollSnap: htmlStyles.scrollSnapType || null,
			stickyElements: []
		};
		
		// Find sticky elements
		const allElements = document.querySelectorAll('*');
		allElements.forEach(el => {
			const position = getComputedStyles(el).position;
			if (position === 'sticky' || position === 'fixed') {
				interactions.scrolling.stickyElements.push(el.className || el.tagName.toLowerCase());
			}
		});
		
		// Extract transitions
		const elementsWithTransitions = Array.from(allElements).filter(el => {
			const transition = getComputedStyles(el).transition;
			return transition && transition !== 'none' && transition !== 'all 0s ease 0s';
		});
		
		elementsWithTransitions.slice(0, 10).forEach(el => {
			const styles = getComputedStyles(el);
			interactions.transitions.push({
				selector: el.className || el.tagName.toLowerCase(),
				property: styles.transitionProperty,
				duration: styles.transitionDuration,
				timing: styles.transitionTimingFunction,
				delay: styles.transitionDelay
			});
		});
		
		return interactions;
	}
	
	// Extract responsive breakpoints
	function extractBreakpoints() {
		// Common breakpoint values to check
		const commonBreakpoints = [
			{ name: 'xs', minWidth: '0px', maxWidth: '639px' },
			{ name: 'sm', minWidth: '640px', maxWidth: '767px' },
			{ name: 'md', minWidth: '768px', maxWidth: '1023px' },
			{ name: 'lg', minWidth: '1024px', maxWidth: '1279px' },
			{ name: 'xl', minWidth: '1280px', maxWidth: '1535px' },
			{ name: '2xl', minWidth: '1536px' }
		];
		
		// Try to detect actual breakpoints from container max-widths
		const containers = document.querySelectorAll('[class*="container"], .wrapper, main');
		const detectedBreakpoints = [];
		
		containers.forEach(container => {
			const maxWidth = getComputedStyles(container).maxWidth;
			if (maxWidth && maxWidth !== 'none') {
				detectedBreakpoints.push({
					name: 'container',
					container: maxWidth
				});
			}
		});
		
		return detectedBreakpoints.length > 0 ? detectedBreakpoints : commonBreakpoints;
	}
	
	// Extract asset strategies
	function extractAssets() {
		const assets = {
			images: {
				lazyLoading: false,
				formats: [],
				optimization: 'standard',
				placeholders: 'none'
			},
			icons: {
				system: 'unknown',
				library: null,
				customIcons: []
			},
			fonts: {
				strategy: 'swap',
				preload: [],
				fontDisplay: 'swap'
			}
		};
		
		// Check for lazy loading
		const images = document.querySelectorAll('img');
		images.forEach(img => {
			if (img.loading === 'lazy') {
				assets.images.lazyLoading = true;
			}
			
			// Check image formats
			const src = img.src;
			if (src.includes('.webp')) assets.images.formats.push('webp');
			if (src.includes('.avif')) assets.images.formats.push('avif');
			if (src.includes('.svg')) assets.images.formats.push('svg');
		});
		
		// Check for icon systems
		const svgIcons = document.querySelectorAll('svg');
		if (svgIcons.length > 0) {
			assets.icons.system = 'svg';
		}
		
		// Check for font icon libraries
		const fontAwesome = document.querySelector('[class*="fa-"]');
		if (fontAwesome) {
			assets.icons.system = 'font';
			assets.icons.library = 'font-awesome';
		}
		
		// Check for preloaded fonts
		const preloadLinks = document.querySelectorAll('link[rel="preload"][as="font"]');
		preloadLinks.forEach(link => {
			assets.fonts.preload.push(link.href);
		});
		
		return assets;
	}
	
	// Run all extractions
	try {
		designSystem.colors = extractColors();
		console.log('✅ Extracted colors:', Object.keys(designSystem.colors));
		
		designSystem.typography = extractTypography();
		console.log('✅ Extracted typography:', designSystem.typography.fontFamilies.length, 'font families');
		
		designSystem.spacing = extractSpacing();
		console.log('✅ Extracted spacing:', designSystem.spacing.scale.length, 'spacing values');
		
		designSystem.layout = extractLayout();
		console.log('✅ Extracted layout:', designSystem.layout.flexPatterns.length, 'flex patterns');
		
		designSystem.components = extractComponents();
		console.log('✅ Extracted components:', designSystem.components.length, 'components');
		
		designSystem.interactions = extractInteractions();
		console.log('✅ Extracted interactions');
		
		designSystem.breakpoints = extractBreakpoints();
		console.log('✅ Extracted breakpoints:', designSystem.breakpoints.length);
		
		designSystem.assets = extractAssets();
		console.log('✅ Extracted asset strategies');
		
		console.log('🎉 Design analysis complete!');
		return designSystem;
		
	} catch (error) {
		console.error('❌ Error during design extraction:', error);
		return {
			error: error.message,
			partialData: designSystem
		};
	}
})();
`
}

// TestAnalyzeFontshareDesign analyzes the design system of Fontshare.com
func TestAnalyzeFontshareDesign(t *testing.T) {
	fmt.Println("🎨 Starting Fontshare Design System Analysis")
	fmt.Println("=" + strings.Repeat("=", 50))
	
	// Target URL
	targetURL := "https://www.fontshare.com/"
	
	// Output directory for results
	outputDir := "./data/design-analysis/fontshare"
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		t.Fatalf("Failed to create output directory: %v", err)
	}
	
	// Chrome options for headless operation
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false), // Set to true for headless mode
		chromedp.Flag("disable-gpu", false),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
	)
	
	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()
	
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()
	
	// Set timeout
	ctx, cancel = context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	
	fmt.Printf("🌐 Navigating to: %s\n", targetURL)
	
	var designSystem DesignSystem
	var pageHTML string
	
	err := chromedp.Run(ctx,
		// Navigate to the page
		chromedp.Navigate(targetURL),
		
		// Wait for page to load
		chromedp.Sleep(5*time.Second),
		
		// Wait for main content to be visible
		chromedp.WaitVisible(`body`, chromedp.ByQuery),
		
		// Additional wait for dynamic content
		chromedp.Sleep(3*time.Second),
		
		// Get page HTML for reference
		chromedp.OuterHTML("html", &pageHTML),
		
		// Execute design analysis script
		chromedp.Evaluate(getFontshareAnalysisScript(), &designSystem),
	)
	
	if err != nil {
		t.Fatalf("Failed to analyze design: %v", err)
	}
	
	// Save the design system analysis
	fmt.Println("\n📊 Design Analysis Results:")
	fmt.Println("-" + strings.Repeat("-", 50))
	
	// Print summary
	fmt.Printf("🎨 Colors:\n")
	fmt.Printf("   - Backgrounds: %d\n", len(designSystem.Colors.Background))
	fmt.Printf("   - Text colors: %d\n", len(designSystem.Colors.Text))
	fmt.Printf("   - Border colors: %d\n", len(designSystem.Colors.Border))
	fmt.Printf("   - Gradients: %d\n", len(designSystem.Colors.Gradients))
	fmt.Printf("   - Shadows: %d\n", len(designSystem.Colors.Shadows))
	
	fmt.Printf("\n📝 Typography:\n")
	fmt.Printf("   - Font families: %d\n", len(designSystem.Typography.FontFamilies))
	fmt.Printf("   - Type scale levels: %d\n", len(designSystem.Typography.TypeScale))
	
	fmt.Printf("\n📐 Spacing:\n")
	fmt.Printf("   - Spacing values: %d\n", len(designSystem.Spacing.Scale))
	fmt.Printf("   - Margin values: %d\n", len(designSystem.Spacing.Margins))
	fmt.Printf("   - Padding values: %d\n", len(designSystem.Spacing.Paddings))
	
	fmt.Printf("\n🎯 Layout:\n")
	fmt.Printf("   - Containers: %d\n", len(designSystem.Layout.Containers))
	fmt.Printf("   - Flex patterns: %d\n", len(designSystem.Layout.FlexPatterns))
	fmt.Printf("   - Grid patterns: %d\n", len(designSystem.Layout.GridPatterns))
	
	fmt.Printf("\n🧩 Components:\n")
	fmt.Printf("   - Total components: %d\n", len(designSystem.Components))
	
	// Save design system to JSON
	designSystemFile := filepath.Join(outputDir, "design-system.json")
	designJSON, err := json.MarshalIndent(designSystem, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal design system: %v", err)
	}
	
	if err := os.WriteFile(designSystemFile, designJSON, 0644); err != nil {
		t.Fatalf("Failed to save design system: %v", err)
	}
	
	fmt.Printf("\n💾 Saved design system to: %s\n", designSystemFile)
	
	// Save HTML for reference
	htmlFile := filepath.Join(outputDir, "page.html")
	if err := os.WriteFile(htmlFile, []byte(pageHTML), 0644); err != nil {
		fmt.Printf("Warning: Failed to save HTML: %v\n", err)
	} else {
		fmt.Printf("💾 Saved HTML to: %s\n", htmlFile)
	}
	
	// Generate CSS variables from design system
	generateCSSVariables(designSystem, outputDir)
	
	// Generate implementation guide
	generateImplementationGuide(designSystem, outputDir)
	
	fmt.Println("\n✅ Design analysis completed successfully!")
	fmt.Printf("📁 All files saved to: %s\n", outputDir)
}

// generateCSSVariables creates a CSS file with design tokens
func generateCSSVariables(ds DesignSystem, outputDir string) {
	var cssContent strings.Builder
	
	cssContent.WriteString("/* Generated CSS Variables from Fontshare Design System */\n")
	cssContent.WriteString("/* Generated: " + time.Now().Format("2006-01-02 15:04:05") + " */\n\n")
	cssContent.WriteString(":root {\n")
	
	// Colors
	cssContent.WriteString("  /* === Colors === */\n")
	
	// Background colors
	for _, color := range ds.Colors.Background {
		cssContent.WriteString(fmt.Sprintf("  --%s: %s;\n", color.Name, color.Value))
	}
	
	// Text colors
	for _, color := range ds.Colors.Text {
		cssContent.WriteString(fmt.Sprintf("  --%s: %s;\n", color.Name, color.Value))
	}
	
	// Border colors
	for _, color := range ds.Colors.Border {
		cssContent.WriteString(fmt.Sprintf("  --%s: %s;\n", color.Name, color.Value))
	}
	
	// Typography
	cssContent.WriteString("\n  /* === Typography === */\n")
	for i, font := range ds.Typography.FontFamilies {
		cssContent.WriteString(fmt.Sprintf("  --font-family-%d: %s;\n", i+1, font.Stack))
	}
	
	// Type scale
	cssContent.WriteString("\n  /* === Type Scale === */\n")
	for _, scale := range ds.Typography.TypeScale {
		cssContent.WriteString(fmt.Sprintf("  --font-size-%s: %s;\n", scale.Name, scale.Size))
		cssContent.WriteString(fmt.Sprintf("  --line-height-%s: %s;\n", scale.Name, scale.LineHeight))
		cssContent.WriteString(fmt.Sprintf("  --font-weight-%s: %s;\n", scale.Name, scale.Weight))
	}
	
	// Spacing
	cssContent.WriteString("\n  /* === Spacing === */\n")
	for i, value := range ds.Spacing.Scale {
		cssContent.WriteString(fmt.Sprintf("  --spacing-%d: %s;\n", i+1, value))
	}
	
	// Shadows
	if len(ds.Colors.Shadows) > 0 {
		cssContent.WriteString("\n  /* === Shadows === */\n")
		for i, shadow := range ds.Colors.Shadows {
			cssContent.WriteString(fmt.Sprintf("  --shadow-%d: %s;\n", i+1, shadow))
		}
	}
	
	cssContent.WriteString("}\n")
	
	// Save CSS file
	cssFile := filepath.Join(outputDir, "design-tokens.css")
	if err := os.WriteFile(cssFile, []byte(cssContent.String()), 0644); err != nil {
		fmt.Printf("Warning: Failed to save CSS variables: %v\n", err)
	} else {
		fmt.Printf("💾 Generated CSS variables: %s\n", cssFile)
	}
}

// generateImplementationGuide creates a markdown guide for engineers
func generateImplementationGuide(ds DesignSystem, outputDir string) {
	var guide strings.Builder
	
	guide.WriteString("# Fontshare Design System Implementation Guide\n\n")
	guide.WriteString("Generated: " + time.Now().Format("2006-01-02 15:04:05") + "\n\n")
	guide.WriteString("## Overview\n\n")
	guide.WriteString("This guide provides implementation details for recreating the Fontshare design system.\n\n")
	
	// Color Palette
	guide.WriteString("## Color Palette\n\n")
	guide.WriteString("### Background Colors\n")
	for _, color := range ds.Colors.Background {
		guide.WriteString(fmt.Sprintf("- **%s**: `%s` - %s\n", color.Name, color.Value, color.Usage))
	}
	
	guide.WriteString("\n### Text Colors\n")
	for _, color := range ds.Colors.Text {
		guide.WriteString(fmt.Sprintf("- **%s**: `%s` - %s\n", color.Name, color.Value, color.Usage))
	}
	
	// Typography
	guide.WriteString("\n## Typography\n\n")
	guide.WriteString("### Font Families\n")
	for _, font := range ds.Typography.FontFamilies {
		guide.WriteString(fmt.Sprintf("- **%s** (%s)\n", font.Name, font.Category))
		guide.WriteString(fmt.Sprintf("  - Stack: `%s`\n", font.Stack))
		guide.WriteString(fmt.Sprintf("  - Usage: %s\n", font.Usage))
	}
	
	guide.WriteString("\n### Type Scale\n")
	guide.WriteString("| Element | Size | Line Height | Weight |\n")
	guide.WriteString("|---------|------|-------------|--------|\n")
	for _, scale := range ds.Typography.TypeScale {
		guide.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", 
			scale.Name, scale.Size, scale.LineHeight, scale.Weight))
	}
	
	// Spacing
	guide.WriteString("\n## Spacing System\n\n")
	guide.WriteString("Base unit: " + ds.Spacing.BaseUnit + "\n\n")
	guide.WriteString("### Spacing Scale\n")
	for i, value := range ds.Spacing.Scale {
		guide.WriteString(fmt.Sprintf("- Level %d: `%s`\n", i+1, value))
	}
	
	// Layout
	guide.WriteString("\n## Layout Patterns\n\n")
	if len(ds.Layout.Containers) > 0 {
		guide.WriteString("### Containers\n")
		for _, container := range ds.Layout.Containers {
			guide.WriteString(fmt.Sprintf("- **%s**\n", container.Name))
			guide.WriteString(fmt.Sprintf("  - Max Width: `%s`\n", container.MaxWidth))
			guide.WriteString(fmt.Sprintf("  - Padding: `%s`\n", container.Padding))
			guide.WriteString(fmt.Sprintf("  - Margin: `%s`\n", container.Margin))
		}
	}
	
	// Components
	if len(ds.Components) > 0 {
		guide.WriteString("\n## Component Specifications\n\n")
		maxComps := len(ds.Components)
		if maxComps > 5 {
			maxComps = 5
		}
		for _, comp := range ds.Components[:maxComps] { // Limit to first 5 for brevity
			guide.WriteString(fmt.Sprintf("### %s (%s)\n", comp.Name, comp.Type))
			guide.WriteString(fmt.Sprintf("Selector: `%s`\n\n", comp.Selector))
			guide.WriteString("**Properties:**\n")
			for key, value := range comp.Properties {
				if value != "" && value != "none" && value != "0px" {
					guide.WriteString(fmt.Sprintf("- %s: `%s`\n", key, value))
				}
			}
			guide.WriteString("\n")
		}
	}
	
	// Responsive Design
	guide.WriteString("\n## Responsive Breakpoints\n\n")
	for _, bp := range ds.Breakpoints {
		guide.WriteString(fmt.Sprintf("- **%s**: ", bp.Name))
		if bp.MinWidth != "" {
			guide.WriteString(fmt.Sprintf("min-width: `%s`", bp.MinWidth))
		}
		if bp.MaxWidth != "" {
			guide.WriteString(fmt.Sprintf(", max-width: `%s`", bp.MaxWidth))
		}
		if bp.Container != "" {
			guide.WriteString(fmt.Sprintf(", container: `%s`", bp.Container))
		}
		guide.WriteString("\n")
	}
	
	// Implementation Notes
	guide.WriteString("\n## Implementation Notes\n\n")
	guide.WriteString("1. **CSS Variables**: Use the generated `design-tokens.css` file for consistent theming\n")
	guide.WriteString("2. **Typography**: Implement the type scale using CSS classes or utility classes\n")
	guide.WriteString("3. **Spacing**: Use the spacing scale for consistent margins and paddings\n")
	guide.WriteString("4. **Components**: Follow the component specifications for consistent UI elements\n")
	guide.WriteString("5. **Responsive**: Implement breakpoints for mobile-first responsive design\n")
	
	// Save guide
	guideFile := filepath.Join(outputDir, "implementation-guide.md")
	if err := os.WriteFile(guideFile, []byte(guide.String()), 0644); err != nil {
		fmt.Printf("Warning: Failed to save implementation guide: %v\n", err)
	} else {
		fmt.Printf("💾 Generated implementation guide: %s\n", guideFile)
	}
}

// TestSetupFontshareProfile sets up a Chrome profile for Fontshare analysis
func TestSetupFontshareProfile(t *testing.T) {
	fmt.Println("🌐 Setting up Chrome profile for Fontshare...")
	fmt.Println("This is a simple setup as Fontshare doesn't require authentication")
	
	// Create profile directory
	profileDir := "./data/chrome-profile/fontshare"
	if err := os.MkdirAll(profileDir, 0755); err != nil {
		t.Fatalf("Failed to create profile directory: %v", err)
	}
	
	fmt.Printf("✅ Profile directory created: %s\n", profileDir)
	fmt.Println("You can now run TestAnalyzeFontshareDesign to analyze the design system")
}