# Contact information

The addresses the legal documents in [`legal/`](legal/) send people to. Same convention as
[company.md](company.md): a `{{path}}` placeholder, named after its `brand.json` field where one
exists.

**All three may be the same inbox.** What matters is that each is monitored before the documents go
live: two of them carry legal deadlines (below), and a notice that nobody reads still counts as
received.

| Placeholder | What arrives there | In `brand.json` | Value |
|---|---|---|---|
| `{{contact.supportEmail}}` | Customer support, billing questions, cancellations, export requests. Also the contact address the Law on Information Society Services (Art. 5) requires | `contact.supportEmail` | |
| `{{contact.privacyEmail}}` | Data protection requests under GDPR Art. 15–22 (**one month** to answer), sub-processor objections (**14 days** to raise), DPA and audit requests | `contact.privacyEmail` | |
| `{{contact.legalEmail}}` | Legal notices, reports of illegal content (DSA Art. 16), complaints about our moderation decisions, and the single point of contact for authorities (DSA Art. 11) and for users (DSA Art. 12) | — | |

**Languages** for the DSA points of contact are English and Lithuanian (Terms of Service §11). If
that changes, change the Terms too — the DSA requires the languages to be stated.

## Public profiles

From `brand.json` `social`. None of the legal documents use them; they are listed so this folder
holds everything `brand.json` does.

| Placeholder | In `brand.json` | Value |
|---|---|---|
| `{{social.x}}` | `social.x` | |
| `{{social.linkedin}}` | `social.linkedin` | |
| `{{social.facebook}}` | `social.facebook` | |
| `{{social.instagram}}` | `social.instagram` | |
| `{{social.github}}` | `social.github` | |
