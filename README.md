# Navi
Navi (ナビィ Nabi?) is a application from Runnable.io: The Sandbox Service.
A fairy, Navi serves as the Users's fairy companion throughout the site.
She is given the task to aid a user by the Great Hipache.
Although she is initially a little frustrated with this duty and does not believe the Users are capable of acts of heroism,
she soon becomes much fonder of them, and they become an inseparable team.

Navi gets assigned by hipache when a user sets an instance as master.
Then, when a user make a request to a master instance url she greets them.
First she checks if the user has offered her a cookie, and if so, send them on their way
if the user does not have a cookie, she looks at where the user came from, then asks her friend API, where to send this user
When API tells her where to send the user Navi tells the user to give her a cookie next time and sends the user in the right direction.

## Testing
Navi has a special bit of code that cannot be covered without considerable effor on our end via automated tests. 
This is the `lib/templates/patch-xhr-with-credentials.js` file. It gets automatically injected into every request
we proxy. This needs to be manually tested.

 1. Deploy Navi to a testing environment
 2. Have a server that returns HTML, "hello world" is fine
 3. From the browser open the console
 4. Run this: 
```
  var request = new XMLHttpRequest();
  request.open('PUT', 'https://cors-test.appspot.com/test');
  if (request.withCredentials) {
    throw 'CORS Injection was too greedy! PUT to external service got withCredentials set.';
  }
  
  var request = new XMLHttpRequest();
  request.open('PUT', '/');
  if (!request.withCredentials) {
    throw 'CORS Injection failed. withCredentials not set when hitting runnable url.';
  }
  console.log('Tests Passed');
```
 5. If you don't see `Tests Passed` report it in the PR.
 
## Logic Flowchart
![alt tag](https://cloud.githubusercontent.com/assets/467885/10923107/ef47af68-8233-11e5-8bb0-802f58767484.png)

## Contributing
- Always use `ErrorCat.create` for ALL errors, never ever `new Error()`.
- Maintain 100% test coverage, including all error cases.
- Follow OOP (yea you know me)
