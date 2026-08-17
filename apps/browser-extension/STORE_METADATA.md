# Store Listing Metadata (Chrome Web Store & Firefox AMO)

This document contains standard metadata and store submission values for publishing `browser-kakoune` to the **Chrome Web Store** and **Firefox Add-ons (AMO)**.

---

## 1. General Product Information

- **Extension Name**: `browser-kakoune`
- **Display Name**: `browser-kakoune: Kakoune Modal Editing for the Web`
- **Short Summary / Description** (Max 132 chars for Chrome Web Store):
  > Authentic Kakoune modal editing for textareas, inputs, and CodeMirror editors across the web with multi-cursor support.
- **Detailed Description**:
  ```markdown
  Bring the authentic Kakoune modal editing experience to any webpage!

  browser-kakoune seamlessly upgrades standard HTML textareas and existing CodeMirror 5 / 6 editor instances into fully-featured Kakoune modal editors with true multi-cursor editing, secondary selections, floating mode indicators, and customizable kakrc keybindings.

  Key Features:
  • Selection-First Modal Editing: Authentic Kakoune verbs and object selections.
  • In-Place CodeMirror 6 Swap: Enhances standard textareas on demand or automatically.
  • CodeMirror 5 & 6 Native Support: Seamless integration with embedded editors on GitHub, LeetCode, REPLs, and more.
  • True Multi-Cursor & Multi-Selection: Secondary selections, block selections, and line-duplication (C / Alt+C).
  • Shadow DOM Overlays: Floating mode indicator, which-key hint popup, and regex search/split prompt (s / S) isolated from host page styles.
  • Custom kakrc: Configure remappings (map global normal, map global insert, declare-user-mode) in the options dashboard.
  • Per-Site Whitelist & Blacklist: Toggle on/off per domain or globally with Alt+Shift+K.
  • 100% Client-Side & Private: No telemetry, no remote servers, no tracking. All state is stored locally in your browser.
  ```

---

## 2. Store Categorization & Tags

### Chrome Web Store
- **Primary Category**: `Developer Tools` or `Productivity`
- **Language**: `English`

### Firefox Add-ons (AMO)
- **Primary Category**: `Developer Tools`
- **Secondary Category**: `Appearance & Customization` or `Other`
- **Tags / Keywords**: `kakoune`, `vim`, `modal editing`, `codemirror`, `editor`, `multi-cursor`, `developer tools`, `productivity`

---

## 3. Privacy Disclosures & Permissions Justification

Both stores require clear justifications for declared permissions:

### Host Permissions (`<all_urls>`)
- **Justification**:
  > The extension needs access to web pages so users can enable Kakoune modal editing on textareas, inputs, and embedded CodeMirror editors across any website they visit. All code runs strictly client-side on the user's active page without collecting or transmitting any data.

### Storage (`storage`)
- **Justification**:
  > Used exclusively to save and sync user preferences locally (such as default editor mode, color themes, domain whitelists/blacklists, and custom kakrc remappings) using Chrome/Firefox sync storage.

### Active Tab (`activeTab`)
- **Justification**:
  > Used when the user interacts with the extension popup or triggers the keyboard shortcut (Alt+Shift+K) to toggle modal editing on the currently active tab.

### Context Menus (`contextMenus`)
- **Justification**:
  > Provides right-click context menu options to quickly enable/disable modal editing or open the settings dashboard for the current domain.

### Privacy Policy / Single Purpose Declaration
- **Single Purpose**:
  > Provide Kakoune-style modal text editing for text fields and code editors on web pages.
- **Data Collection Declaration**:
  - Does the extension collect personal data? **No**
  - Does the extension transmit user data to external servers? **No**
  - Does the extension use analytics or remote tracking? **No**
  - All processing and storage is 100% local within the browser.

---

## 4. Visual Assets Checklist

Prepare the following image assets before submitting:

### Chrome Web Store
- **Icon**: `128x128` PNG (transparent background)
- **Store Icon / Small Tile**: `440x280` PNG or JPEG
- **Marquee Promo Tile** (Optional): `1400x560` PNG or JPEG
- **Screenshots**: At least 1 (recommended 3-5), `1280x800` or `640x400` PNG/JPEG showing:
  1. Multi-cursor modal editing on a textarea.
  2. CodeMirror 5/6 native page integration (e.g. GitHub or LeetCode).
  3. Interactive options dashboard with custom `kakrc` remapping.

### Firefox Add-ons (AMO)
- **Extension Icon**: `32x32`, `48x48`, `64x64`, `128x128` PNG
- **Screenshots**: Up to 5 screenshots showing key features.

---

## 5. Support & Repository URLs

- **Homepage / Repository**: `https://github.com/Yukaii/codemirror-kakoune`
- **Support / Issue Tracker**: `https://github.com/Yukaii/codemirror-kakoune/issues`

---

## 6. Automated Store Publishing (CI/CD GitHub Secrets)

Once the first version is manually reviewed and published on the developer consoles, configure the following **GitHub Actions Repository Secrets** to enable 100% automated store uploads on subsequent releases:

### Chrome Web Store (Google Cloud API)
- `CHROME_EXTENSION_ID`: The ID assigned to your extension on the Chrome Web Store dashboard.
- `CHROME_CLIENT_ID`: OAuth 2.0 Client ID from Google Cloud Console.
- `CHROME_CLIENT_SECRET`: OAuth 2.0 Client Secret from Google Cloud Console.
- `CHROME_REFRESH_TOKEN`: Refresh token generated for Chrome Web Store API access.

### Firefox Add-ons (Mozilla AMO)
- `FIREFOX_JWT_ISSUER`: API Key Issuer from Mozilla Add-on Developer Hub.
- `FIREFOX_JWT_SECRET`: API Key Secret from Mozilla Add-on Developer Hub.

*(Note: If these secrets are not defined, the release workflow skips store uploading and still publishes the GitHub Release with attached `.zip` files.)*
