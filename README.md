# Nextooly PDF Tools (AGPL)

**Live Demo:** https://pdf.nextooly.com

This repository contains the source code for Nextooly’s browser-based PDF tools:
- PDF Compressor
- Protect PDF
- Unlock PDF
- Edit PDF

All tools run **100% client-side** using WebAssembly (WASM).  
No files, passwords, or user data are uploaded or stored.

## License

This project is licensed under the **GNU Affero General Public License v3 (AGPL-3.0)**.

If you deploy this software publicly (website, SaaS, or network service), you **must provide access to the complete corresponding source code** of the deployed version to all users, as required by AGPL §13.

Any derivative work must also be licensed under AGPL-3.0.

License text: https://www.gnu.org/licenses/agpl-3.0.html

## Architecture Note

This repository is intentionally isolated to comply with AGPL requirements of PDF processing engines.  
The main platform (https://nextooly.com) links to this application as a separate service and does not embed or bundle this code.

## Development

pnpm install  
pnpm dev

## Trademark

“Nextooly” and the Nextooly logo are trademarks of Nextooly.  
This license does not grant permission to use the Nextooly name or branding without explicit permission.

© 2026 Nextooly
