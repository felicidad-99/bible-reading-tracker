import { GroupsSection } from "@/components/groups-section";

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <header className="fade-up">
        <p className="eyebrow">Community</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          Groups
        </h1>
      </header>
      <GroupsSection hideHeading />
    </div>
  );
}
