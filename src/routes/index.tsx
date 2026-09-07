import { createFileRoute } from "@tanstack/react-router";
import { NexusWardApp } from "@/components/game/NexusWardApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NexusWardApp />;
}
