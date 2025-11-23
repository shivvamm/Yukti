# Yukti Landing Page

Landing page for the Yukti browser extension, built with Next.js and styled with the pixelated robot theme.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000`

## Build for Production

```bash
# Build static export
npm run build

# The output will be in the `out` directory
```

## Deploy to Vercel

1. Push this code to your GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Vercel will automatically detect Next.js and deploy

## Features

- ✨ Pixelated robot theme matching the extension
- 📱 Responsive design
- ⚡ Fast static export
- 🎨 Tailwind CSS styling
- 🤖 Animated robot icon

## Download Setup

To enable the download functionality, you need to:

1. Build the extension using `npm run build` in the `yukti` directory
2. Zip the `build/chrome-mv3-prod` folder
3. Place the zip file in the `website/public` directory as `yukti-extension.zip`

The download button will then work correctly.
