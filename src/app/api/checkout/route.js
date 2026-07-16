import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { cart, total } = body;

    if (!cart || cart.length === 0) {
      return NextResponse.json({ success: false, error: 'Cart is empty' }, { status: 400 });
    }

    // Attempt to get the best agent from our OpenWA bot service
    let agentNumber = '254700000000'; // Default fallback number
    
    try {
      // The Next.js app communicates with the standalone OpenWA Node service
      const botResponse = await fetch('http://localhost:3001/api/get-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const botData = await botResponse.json();
      if (botData.success && botData.agent) {
        agentNumber = botData.agent;
      }
    } catch (e) {
      console.warn('WhatsApp Bot service is unreachable. Using fallback agent number.');
    }

    // Format the message
    let messageText = `*Hello Jobea Auto Spares!*\nI would like to inquire about the following items from the store:\n\n`;
    
    cart.forEach((item, index) => {
      messageText += `${index + 1}. *${item.NAME}*`;
      if (item.BRAND) messageText += ` (${item.BRAND})`;
      messageText += `\n   Qty: ${item.cartQty} x Ksh ${Number(item.PRICE).toLocaleString()}`;
      if (item.IMAGE_URL) messageText += `\n   Image: ${item.IMAGE_URL}`;
      messageText += `\n\n`;
    });
    
    messageText += `*Total Estimate:* Ksh ${total.toLocaleString()}\n\n`;
    messageText += `_Is this price negotiable? Let me know your best offer and availability._`;

    // Construct the wa.me URL
    const encodedMessage = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${agentNumber}?text=${encodedMessage}`;

    return NextResponse.json({ success: true, whatsappUrl });
    
  } catch (error) {
    console.error('Checkout API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
