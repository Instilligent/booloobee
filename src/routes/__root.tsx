import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "Booloobee" },
      {
        name: "description",
        content: "Booloobee — scoop unicorn sparkle-poop, shoot rainbows, sell glitter fertilizer. Easy, silly, addictive.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-full bg-bg text-fg antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
