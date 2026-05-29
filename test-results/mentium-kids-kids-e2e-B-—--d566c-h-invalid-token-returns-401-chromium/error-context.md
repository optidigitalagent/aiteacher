# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mentium-kids\kids-e2e.spec.ts >> B — API auth guard >> B2: POST /lesson/kids/start with invalid token returns 401
- Location: tests\mentium-kids\kids-e2e.spec.ts:110:7

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:4000
Call log:
  - → POST http://localhost:4000/lesson/kids/start
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Authorization: Bearer invalid.jwt.token
    - content-type: application/json
    - content-length: 2

```