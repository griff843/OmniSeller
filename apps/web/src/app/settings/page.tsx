export default function SettingsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <a className="underline text-blue-600" href="http://localhost:3001/ebay/authorize">
        Connect eBay
      </a>
      <p className="text-sm text-gray-600">
        After auth, eBay will redirect back to: http://localhost:3000/api/ebay/callback
      </p>
    </div>
  );
}
