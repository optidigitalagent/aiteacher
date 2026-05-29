# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mentium-kids\kids-e2e.spec.ts >> B — API auth guard >> B4: GET /kids route is publicly reachable (frontend, not auth-gated at HTTP level)
- Location: tests\mentium-kids\kids-e2e.spec.ts:135:7

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:5173
Call log:
  - → GET http://localhost:5173/kids
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```