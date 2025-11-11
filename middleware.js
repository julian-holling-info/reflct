import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

//  Add the protection to these pages i.e. - If not signed in - re-direct to the sign in page.
//  the .* indicates any page name in the route further down the routing path e.g /journal/1/entry
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/journal(.*)",
  "/collection(.*)",
]);

//  We will add Shield and bot detection here using the Arcjet library


//  Adds an async callback function taking in Auth and the request ...

//  Create base Clerk middleware/
export default clerkMiddleware(async (auth, req) => {
    
  const {userId} = await auth();  //  destructs the userId, an redirect callbak location  from the call to auth
    
    //  Check to see if the user is aexists and the route is protected (see above).  The request is in the path of the url!!!
    if(!userId && isProtectedRoute(req)) {
      const { redirectToSignIn } = await auth();
      return redirectToSignIn();  //  performs the redirect to the sign in page.
    }

    return NextResponse.next(); //  Continues to the next step in the middleware pipeline.
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};