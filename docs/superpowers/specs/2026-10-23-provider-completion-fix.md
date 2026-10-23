# Complete evidence-backed store lookups without an extra model round

The reported response conflates model timeout with quota exhaustion. Live status shows 83 local requests remain, DeepSeek is configured, and the embedding index is genuinely empty. A direct tool call succeeded in 32.8 seconds; the full turn previously exhausted its 60-second deadline during a later model request.

For a simple store-discovery or selected-product offer lookup, finish the provider phase after its successful validated discovery/offer tool. Existing server orchestration hydrates actual linked offers with every hard constraint. Do not apply this shortcut to explicit compound comparison, alternative, inquiry or visit requests. Keep multi-step reasoning for other intents and preserve limits, provider and provenance. Never suppress a genuine failure or pretend the embedding index exists.

Alternatives considered: increasing the deadline again would increase waiting without avoiding unnecessary calls; switching providers contradicts the user's choice of DeepSeek. The narrowly bounded completion shortcut and accurate failure-specific Persian copy address the observed application behavior. This is an implementation decision under the user's existing instruction to proceed with routine fixes without nonessential questions.

Verify with regression tests that one sufficient model tool response completes a simple store/offer request, comparison remains multi-step, and timeout/auth/provider-limit/local-quota errors are distinguished. Run the suite, lint, typecheck and build, then restart and run one bounded live reported scenario. Any provider latency that remains is an external limitation. Embedding indexing requires a separately approved bounded API job.
