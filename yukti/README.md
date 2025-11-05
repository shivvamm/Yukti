# Yukti - Privacy-First AI Browser Assistant

Yukti is an intelligent browser extension that learns from your browsing behavior to provide personalized suggestions while maintaining strict privacy standards. All data stays on your device, and sensitive information is never tracked.

## Features

### Intelligent Behavior Tracking
- **Click Tracking**: Monitors elements you interact with to understand your preferences
- **Scroll Behavior**: Analyzes how you engage with content
- **Navigation Patterns**: Learns which sites you visit frequently
- **Time Tracking**: Records time spent on pages to identify your interests
- **Form Interactions**: Optional tracking of non-sensitive form fields

### AI-Powered Suggestions
- Personalized recommendations based on your browsing patterns
- Time spent analysis and productivity insights
- Content engagement predictions
- Frequently visited sites quick access

### Privacy First Design
- **Local Storage Only**: All data is stored on your device, never sent to external servers
- **Sensitive Data Protection**: Passwords, credit cards, and payment info are never tracked
- **Automatic Blacklisting**: Banking, healthcare, and financial sites are automatically blocked
- **Granular Controls**: Choose exactly what to track with per-feature toggles
- **Pause Anytime**: Temporarily stop tracking with one click
- **Data Ownership**: Export or delete all your data at any time

### User Interface
- **Consent Management**: Clear opt-in with detailed privacy explanations
- **Settings Dashboard**: Fine-grained control over tracking preferences
- **Data Viewer**: See what data has been collected
- **Statistics**: Track your browsing patterns with visual insights
- **Export/Delete**: Full data portability and the right to be forgotten

## Technical Architecture

### Content Scripts (`contents/behavior-monitor.ts`)
Runs in the context of web pages to monitor user interactions:
- Tracks clicks, scrolls, and navigation events
- Implements privacy filters for sensitive inputs
- Respects domain blacklists
- Communicates with background service worker

### Background Service Worker (`background.ts`)
Processes and analyzes interaction data:
- Aggregates data from all tabs
- Analyzes patterns to generate insights
- Updates user behavior models
- Generates AI suggestions based on patterns

### Popup UI (`popup.tsx`)
User interface for the extension:
- Consent management flow
- Privacy settings configuration
- Real-time suggestions display
- Data management tools
- Statistics and insights

## Getting Started

### Prerequisites
- Node.js 16+ or 18+
- Yarn package manager
- Chrome browser (Manifest V3)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shivvamm/Yukti.git
cd yukti
```

2. Install dependencies:
```bash
yarn install
```

3. Build the extension:
```bash
yarn build
```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` directory

### Development

Run the development server with hot reload:
```bash
yarn dev
```

Load the development build from `build/chrome-mv3-dev` in your browser. Changes will auto-reload.

## Usage

### First Time Setup

1. Click the Yukti extension icon in your toolbar
2. Review the consent screen explaining what data is tracked
3. Accept or decline tracking based on your preference
4. If accepted, configure granular settings in the Settings tab

### Managing Settings

Navigate to the Settings tab to control:
- Enable/disable tracking globally
- Pause tracking temporarily
- Toggle individual tracking features:
  - Clicks
  - Scrolling
  - Navigation
  - Form interactions

### Viewing Suggestions

The Home tab displays AI-generated suggestions based on your behavior:
- Frequently visited sites
- Time spent insights
- Content engagement patterns
- Productivity recommendations

### Data Management

The Data tab provides:
- Total interaction count
- Tracking start date
- Top visited sites
- Export data as JSON
- Delete all data permanently

## Privacy Guarantees

### What We Track
- Pages you visit (URLs)
- Elements you click (non-sensitive)
- Scroll depth on pages
- Time spent on pages
- Non-sensitive form interactions (optional)

### What We Never Track
- Passwords or password fields
- Credit card numbers or payment information
- Any input marked as sensitive (type="password", etc.)
- Content on banking or healthcare sites
- Personal identifiable information (PII)

### Data Storage
- All data is stored locally using Chrome's `chrome.storage.local` API
- No data is sent to external servers
- No analytics or telemetry
- No third-party services

### Security Features
- Automatic blacklisting of sensitive domains
- Input type detection to filter passwords/payment info
- Consent-based tracking (opt-in by default)
- One-click pause functionality
- Complete data deletion available

## Project Structure

```
yukti/
├── contents/
│   └── behavior-monitor.ts    # Content script for tracking
├── background.ts               # Background service worker
├── popup.tsx                   # Main UI component
├── assets/
│   └── icon.png               # Extension icon
├── package.json               # Project configuration
└── README.md                  # This file
```

## Technology Stack

- **Framework**: Plasmo (v0.90.5)
- **UI Library**: React (v18.2.0)
- **Language**: TypeScript (v5.3.3)
- **Manifest**: Chrome Manifest V3
- **Storage**: Chrome Storage API
- **Build Tool**: Parcel (via Plasmo)

## Development

### Adding New Features

1. **New Content Script**: Add files to `contents/` directory
2. **Background Logic**: Edit `background.ts`
3. **UI Changes**: Modify `popup.tsx`
4. **Permissions**: Update `package.json` manifest section

### Building for Production

```bash
yarn build
```

Outputs to `build/chrome-mv3-prod/`

### Code Style

The project uses Prettier with import sorting:
```bash
yarn prettier --write .
```

## Future Enhancements

- [ ] Machine learning model for better suggestions
- [ ] Natural language processing for content analysis
- [ ] Browser history integration
- [ ] Bookmark organization suggestions
- [ ] Time management recommendations
- [ ] Productivity metrics dashboard
- [ ] Custom blacklist domain management
- [ ] Multiple AI models support

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

**Shivam Pandey**
- GitHub: [@shivvamm](https://github.com/shivvamm)

## Acknowledgments

- Built with [Plasmo Framework](https://docs.plasmo.com/)
- Inspired by privacy-first AI assistants
- Icon design placeholder (update with actual credits)

## Support

For issues, questions, or suggestions, please [open an issue](https://github.com/shivvamm/Yukti/issues) on GitHub.

---

**Note**: Yukti is in active development (v0.0.1). Features and functionality may change.
