# Intelligence Copilot

Without an API key, the application displays **Rules-based evidence mode**. Supported intents: totals, severity, districts, categories, monthly trends, connected hotspots, weekly warnings, declared networks and active aggregate models. Recent district/category/date context is carried in a validated structured request. Empty combined incident scope returns a cited zero result. Reset context clears scope; “all districts” and “all categories” clear their corresponding constraints.

English examples: “How many incidents?”, “Show severity in Bengaluru”, “What about Fraud?”, “Show monthly trends”, “Show hotspots”, “Show active models”. Kannada examples: “ಒಟ್ಟು ಎಷ್ಟು ಘಟನೆಗಳು”, “ಬೆಂಗಳೂರು ಒಟ್ಟು ಘಟನೆಗಳು”, “ಮೈಸೂರು ಕಳ್ಳತನ ಎಷ್ಟು”, “ಎಚ್ಚರಿಕೆ”. Kannada support is bounded keyword/alias routing with Kannada answer templates; it is not unrestricted natural-language understanding. Dataset category/district values remain as uploaded.

Each successful factual response includes dataset identity, checksum, provenance, tool, scope, matching row count and a stable dataset evidence reference. Network and model responses use the selected dataset's auxiliary records, rather than pretending that incident-date filters constrain those separate records. Network identifiers are masked for viewers. No answer claims the source is authenticated.

To enable **AI tool-routing mode**, set `LLM_API_KEY` and `LLM_MODEL` for an approved OpenAI chat-completions-compatible model. The endpoint is fixed to `https://api.openai.com/v1/chat/completions`; the provider only produces a validated tool-name/scope JSON object. It gets the question and context, not the incident table. An unsupported tool, additional SQL field, malformed JSON or provider failure is explicitly rejected. All metrics are then calculated by server tools. Provider responses are mocked in tests; no live model was used for verification. Provider model availability is deployment configuration, not a hardcoded claim.

Individual criminality prediction, protected-attribute profiling, guilt determination and arrest/enforcement recommendations are outside the allow-list. The refusal router adds explicit responses for recognizable requests. Keyword refusals are not an enterprise abuse-detection system; even an unrecognized harmful question cannot invoke an individual-scoring or SQL tool because none exists.

Voice: browser recognition uses `en-IN`/`kn-IN`; text-to-speech is optional. CrimeStack stores no audio, but the browser vendor may process speech remotely. Unsupported recognition/TTS produces a visible message. Do not enable microphone access for sensitive material without your organization's approval. Conversation export uses browser Print → Save as PDF. Conversation content is held in the current component, not persisted as a server transcript; queries are audited by mode/dataset without logging question text.


## Added in 0.2

Controlled tools now include `patterns`, `repeat_cases`, `context` and `prevention`. Socio-economic answers recompute matched-district rates/correlation on the current incident scope and cite the imported indicator record. Network/repeat-case answers cite their relationship imports and retain role masking. Model answers retain the training snapshot but filter district/category signals. Each auxiliary source preserves its own provenance label.

English month/year phrases such as “January 2026” and ISO start/end date pairs set calendar scope; invalid or reversed dates return 422. The UI shows scope chips. “Show theft in Bengaluru in January 2026” followed by “What about Mysuru?” retains category and dates. PDF export prints only the transcript and citations, using browser fonts for Kannada.

Pattern scores describe historical district-category weeks; they are not individual profiles or future probabilities. Prevention responses provide data-quality/evidence-review steps, not enforcement advice.
