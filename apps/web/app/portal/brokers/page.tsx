export default function ClientBrokerListPage() {
  return (
    <div>
      <h1>Brokers</h1>
      <p>
        Placeholder - will list brokers scoped to this organization (row-level scoping by
        organization_id, Section 4) once org-level auth exists. Only brokers with a GRANTED
        AccessGrant for this organization should appear here (Section 1.1).
      </p>
    </div>
  );
}
