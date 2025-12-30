# Web Equalizer

A powerful 10-band audio equalizer extension for Google Chrome that works on any website.

## Features

- **10-Band Equalizer**: Fine-tune specific frequencies from 32Hz to 16kHz.
- **Universal Compatibility**: Automatically detects and applies audio effects to `audio` and `video` elements on any webpage.
- **YouTube Music Integration**: Special integration with YouTube Music for seamless control.
- **Presets System**:
    - Includes built-in presets for various music genres.
    - Create, save, and delete your own custom presets.
- **Real-time Synchronization**: Changes made in the popup are instantly applied to all open tabs.
- **Lightweight & Fast**: Built with modern web technologies for minimal performance impact.

## Installation

### From Source

1.  Clone this repository:
    ```bash
    git clone https://github.com/ZDAVanO/web-equalizer.git
    cd web-equalizer
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    npm ci
    ```

3.  Build the extension:
    ```bash
    npm run build
    ```

4.  Load into Chrome:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable **Developer mode** in the top right corner.
    - Click **Load unpacked**.
    - Select the `dist` folder generated in your project directory.

## Development

To run the project in development mode with hot reload:

```bash
npm run dev
```

## Tech Stack

- **Vite**: Fast tooling and build system.
- **TypeScript**: For type-safe code.
- **@crxjs/vite-plugin**: Seamless Vite integration for Chrome Extensions.
- **Web Audio API**: The core technology behind the equalization.

## License

[MIT](LICENSE)
