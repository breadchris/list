import { RabbitHoleInterface } from "@/components/rabbit-hole/RabbitHoleInterface";

interface Props {
  params: Promise<{
    roomId: string;
  }>;
}

/**
 * Public rabbit hole page
 *
 * Renders a readonly view of an exploration.
 * Any exploration is accessible via /rabbit-hole/pub/{roomId} - no explicit publish step needed.
 */
export default async function PublicRabbitHolePage({ params }: Props) {
  const { roomId } = await params;

  return (
    <div className="h-screen bg-background">
      <RabbitHoleInterface roomId={roomId} isReadOnly />
    </div>
  );
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: Props) {
  const { roomId } = await params;

  return {
    title: "Rabbit Hole Exploration",
    description: "AI-guided topic exploration",
  };
}
