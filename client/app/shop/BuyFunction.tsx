import { showAlert } from "../components/Alert";

export default async function BuyItem(
  userId: number,
  itemId: number,
  itemPrice: number
) {
  try {
    const res = await fetch("/api/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemPrice }),
    });

    const data = await res.json();

    if (res.ok) {
      showAlert(`Purchase successful: ${data.message}`, 'success');
    } else {
      showAlert(`Purchase failed: ${data.error}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert("Something went wrong!", 'error');
  }
}
