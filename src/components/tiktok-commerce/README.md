
# TikTok Commerce Design System

A mobile-first design system built for the TikTok Commerce Link Hub platform, optimized for Ugandan sellers.

## Overview

This design system provides a comprehensive set of components, tokens, and patterns specifically designed for mobile-first e-commerce experiences. Built on top of shadcn/ui with custom theming for the TikTok Commerce brand.

## Design Principles

- **Mobile-First**: All components default to mobile-optimized styles with progressive enhancement
- **Accessibility**: WCAG 2.1 AA compliant with proper focus management and screen reader support
- **Touch-Friendly**: Minimum 48px tap targets for optimal mobile interaction
- **Performance**: Lightweight components with lazy loading and optimized rendering

## Quick Start

```tsx
import { Button, ProductCard, Layout, Header } from "@/components/tiktok-commerce";

function App() {
  return (
    <Layout
      header={<Header title="TikTok Commerce" />}
    >
      <ProductCard
        title="New Heels"
        price="55,000"
        imageUrl="/product.jpg"
        ctaText="Buy on WhatsApp"
      />
    </Layout>
  );
}
```

## Components

### Button
Mobile-optimized button with TikTok Commerce branding.

**Variants:**
- `primary` - Main call-to-action (red brand color)
- `secondary` - Secondary actions (outlined)
- `accent` - Highlighted actions (gold)
- `success` - Positive feedback
- `warning` - Cautionary actions
- `destructive` - Dangerous actions

**Sizes:**
- `default` - 48px height (recommended)
- `sm` - 40px height
- `lg` - 56px height
- `block` - Full width

```tsx
<Button variant="primary" size="block">
  Get Started
</Button>
```

### Input
Accessible form input with integrated labeling and error states.

```tsx
<Input
  label="TikTok Handle"
  placeholder="@your-handle"
  error="Handle is required"
/>
```

### ProductCard
E-commerce product display optimized for mobile grids.

```tsx
<ProductCard
  title="Summer Dress"
  price="45,000"
  currency="₵"
  imageUrl="/dress.jpg"
  ctaText="Buy on WhatsApp"
  onCtaClick={() => window.open('https://wa.me/...')}
/>
```

### PageViewCounter
Analytics display widget with formatted numbers.

```tsx
<PageViewCounter count={1234} /> // Shows "1.2k views"
```

### Layout
Mobile-first page layout with sticky header and footer.

```tsx
<Layout
  header={<Header title="Shop" />}
  footer={<Footer />}
>
  <YourContent />
</Layout>
```

## Design Tokens

Accessible via `designTokens` export:

```tsx
import { designTokens } from "@/components/tiktok-commerce";

const { spacing, typography, colors } = designTokens;
```

### Colors
- **Primary**: `#E60023` (TikTok red)
- **Secondary**: `#000000` (Rich black)
- **Accent**: `#FFD700` (Gold)
- **Success**: `#28A745`
- **Warning**: `#FFC107`
- **Error**: `#DC3545`

### Typography Scale
- **Caption**: 12px (`text-xs`)
- **Small**: 14px (`text-sm`)
- **Body**: 16px (`text-base`)
- **Subhead**: 20px (`text-lg`)
- **Heading**: 24px (`text-xl`)
- **Display**: 32px (`text-2xl`)

### Spacing Scale
- **XS**: 4px (`space-xs`, `p-xs`, `m-xs`)
- **SM**: 8px (`space-sm`, `p-sm`, `m-sm`)
- **MD**: 16px (`space-md`, `p-md`, `m-md`)
- **LG**: 24px (`space-lg`, `p-lg`, `m-lg`)
- **XL**: 32px (`space-xl`, `p-xl`, `m-xl`)

## Responsive Patterns

### Container
Use `container-mobile` class for consistent mobile-first containers:

```tsx
<div className="container-mobile">
  <YourContent />
</div>
```

### Grid Layouts
Mobile-first product grids:

```tsx
<div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
  {products.map(product => <ProductCard key={product.id} {...product} />)}
</div>
```

## Accessibility Features

- Minimum 48px tap targets
- High contrast ratios (4.5:1 minimum)
- Focus visible indicators
- Screen reader labels
- Keyboard navigation support

## Development

### Adding New Components
1. Create component in `/components/tiktok-commerce/`
2. Export from `index.ts`
3. Document in this README
4. Add Storybook stories (if applicable)

### Customizing Tokens
Edit `src/lib/design-tokens.ts` and update CSS variables in `src/index.css`.

## Browser Support

- iOS Safari 14+
- Chrome 88+
- Firefox 85+
- Samsung Internet 13+

## Performance

- Tree-shakeable components
- Minimal runtime dependencies
- Optimized for mobile networks
- Lazy loading support
