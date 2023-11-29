---
layout: post
title: Beyond the login page
---

There are many blog posts floating around about “adding authentication to your application”, be it written in Node.js, ASP.NET, Java with Spring Boot, JS in the browser talking to a JSON-based Web API on the server, etc. Most of them handle the login page and password storage, and sometimes logout and a user registration page. But authentication is actually much more than that!

Don't get me wrong, it's great that we can describe in a single blog post how to do such things, but everyone should be aware that this is actually just the beginning of the journey, and most of the time those blog posts don't have any such warnings.

So here are some things to think about when “adding authentication to your application”:

 * are you sure you store passwords securely? and verify them securely?
 * is your logout secure? (ideally cannot be abused by tricking you just clicking a link on a mail or random site)
 * are passwords robust?
   * put a lower bound on password length (NIST [recommends](https://pages.nist.gov/800-63-3/sp800-63b.html#5-authenticator-and-verifier-requirements) a minimum of 8 characters); don't set an upper bound, or if you really want to make sure it's high enough (NIST recommends accepting at least 64 characters)
   * if possible, check passwords (at registration or change) against known compromised passwords (use [Pwned Passwords](https://haveibeenpwned.com/Passwords) or similar)
 * how well do you handle non-ASCII characters? For example, macOS and Windows encode diacritics differently, so make sure that someone who signed up on one device will be able to sign in on another (put differently, use [Unicode normalization](https://en.wikipedia.org/wiki/Unicode_equivalence) on inputs; NIST recommends using NFKC or NFKD)
 * do you have a form to securely change the password? (when already authenticated)
 * are your forms actually compatible with password managers?
 * do you protect against brute-force attacks? if you do (e.g. by locking out accounts, or even just throttling), do you somehow protect legitimate users against DDoS?
 * once authenticated, how do you maintain the authenticated state (_sessions_; <abbr title="by the way">btw</abbr> don't use [JWTs]({% post_url 2023-11-29-jwt %}))? and is this secure? (in other words, do you protect against [session fixation](https://en.wikipedia.org/wiki/Session_fixation)? [cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery)?)
 * how long are your _sessions_? There's a balance between short and long sessions regarding security and convenience, but a choice needs to be made.
 * do you have a mechanism to ask for re-authentication before sensitive actions?
 * what do you do if a user forgot their password? Password recovery generally requires an email address, do you have one? how can you make sure that the user didn't mistype it and you will actually be able to use it when they need it? Put differently: you need a secure email verification process before you can have a secure password reset process. Implementing those processes securely go beyond the scope of this post, but let's just say we've just come from one single blog post explaining how to “add authentication to your application” to a _series_ of blog posts.
 * by the way, now that you store an email address for password reset purpose, how can the user securely update it? and by that I also mean, how do you handle the case where the account got breached and the attacker changes the email address? There's unfortunately no simple answer to that, because there are a handful of cases to handle: the user may have lost access to the previous email, an attacker may have gained access to the previous email, the user may still have access to the previous email but have mistyped the new email, etc.
 * speaking of changing passwords, do you make it easier for password managers? (spoiler: through a [`/.well-known/change-password`](https://w3c.github.io/webappsec-change-password-url/) URL)
 * do you handle multi-factor authentication? do you plan on handling it in the future? If you use SMS to send one-time codes, can the device [autofill the form](https://web.dev/articles/sms-otp-form?hl=en)?
 * how about [passkeys](https://passkeys.dev/)?

That being said, I don't think I ever implemented **all** of the above _perfectly_. There are always tradeoffs. But these are things to think about and make choices, and sometimes deliberate choices to postpone things (or just not implement them, after pondering the risks). Unfortunately, I did however see big mistakes in implementations of the various processes hinted above.

Most of the time nowadays, I prefer offloading this to an identity provider, using [OpenID Connect](https://openid.net/connect/) or soon [Federated Credential Management (FedCM)](https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API), even if that means shipping an identity provider as part of the deliverables (I generally go with [Keycloak](https://keycloak.org/), with [keycloak-config-cli](https://github.com/adorsys/keycloak-config-cli) to provision its configuration). I'm obviously biased though as I work in IT services, developping software mainly for intranets/extranets, and companies now increasingly have their own identity providers or at a minimum have that in their roadmap. So <abbr title="Your mileage may vary">YMMV</abbr>.

And we've only talked about authentication, not even authorization!

Some resources to go farther:

 * NIST [SP 800-63-3](https://pages.nist.gov/800-63-3/sp800-63b.html)
 * OWASP:
   * [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
   * [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
   * [Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
   * [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
   * [Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
   * [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
 * Troy Hunt's [Everything you ever wanted to know about building a secure password reset feature](https://www.troyhunt.com/everything-you-ever-wanted-to-know/)
 * Google:
   * [Sign-in form best practices](https://web.dev/articles/sign-in-form-best-practices?hl=en)
   * [Sign-up form best practices](https://web.dev/articles/sign-up-form-best-practices?hl=en)
   * [Help users change passwords easily by adding a well-known URL for changing passwords](https://web.dev/articles/change-password-url?hl=en)
   * [SMS OTP form best practices](https://web.dev/articles/sms-otp-form?hl=en)
   * [Passwordless login with passkeys](https://developers.google.com/identity/passkeys/)
