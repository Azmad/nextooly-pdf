# Nextooly PDF Tools (AGPL)

This repository contains the Nextooly PDF processing tools:

- PDF Compressor
- Protect PDF
- Unlock PDF

All tools run 100% client-side using WebAssembly (WASM).
No files or passwords are uploaded to any server.

---

## Privacy & Security

- All PDF processing happens locally in your browser
- No server-side uploads
- No file or password storage

---

## License (IMPORTANT)

This project is licensed under the GNU Affero General Public License v3 (AGPL-3.0).

If you deploy this software publicly (as a website or SaaS),
you MUST provide access to the complete corresponding source code
of the deployed version.

Any derivative work must also be licensed under AGPL-3.0.

Full license text:
https://www.gnu.org/licenses/agpl-3.0.html

---

## Why this repository exists separately

This repository is intentionally isolated to comply with AGPL
requirements of PDF processing engines (e.g., MuPDF).

The main Nextooly platform links to this application as a
separate service and does not embed or bundle its code.

---

## Development

pnpm install  
pnpm dev

---

## Attribution

Copyright (c) Nextooly
