# TG CAR blog implementation

Approved: separate /blog index and /blog/[slug] articles, existing brand and navigation, cover, date, original text, sharing and related articles. Preserve old release for rollback.

1. Add blog.test.mjs testing unique slugs, complete sections, existing cover files, missing-article lookup and category selection. Run red.
2. Add app/blog/posts.mjs as the single publication source; three original rental guides, dated actual publication day. No invented events, prices or guarantees.
3. Add index with category filters and static article routes with async params, metadata, canonical links, table of contents, share action, related articles and 404 handling.
4. Replace homepage modal triggers with actual article links. Point header/footer Blog to /blog. Preserve document dialog.
5. Test all unit tests and Next build. Verify rendered index, three articles and unknown slug. Deploy a separate release only after passing; retain existing release.
