# In-App Purchase (IAP) Implementation Plan

This document outlines the complete implementation plan for integrating Apple App Store and Google Play Store in-app purchases for subscription billing.

## Table of Contents
1. [Overview](#overview)
2. [App Store Setup](#app-store-setup)
3. [Backend Implementation](#backend-implementation)
4. [Mobile Implementation](#mobile-implementation)
5. [Testing Strategy](#testing-strategy)
6. [Launch Checklist](#launch-checklist)

---

## Overview

### Subscription Tiers
| Plan | Price | Storage | Retention | Apple Product ID | Google Product ID |
|------|-------|---------|-----------|------------------|-------------------|
| Free | $0 | 250 MB | 7 days | N/A | N/A |
| Paid | $19.99/yr | 5 GB | 30 days | `com.taskmanager.paid.yearly` | `paid_yearly` |
| Premium | $99.99/yr | 100 GB | Forever | `com.taskmanager.premium.yearly` | `premium_yearly` |

### Architecture Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App │────▶│   Backend   │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   ▲
       │                   │
       ▼                   │
┌─────────────┐     ┌─────────────┐
│ App Store/  │────▶│  Webhooks   │
│ Play Store  │     │  (Server    │
└─────────────┘     │ Notifications)
```

---

## App Store Setup

### Apple App Store Connect

#### 1. Create App Record
- Log into [App Store Connect](https://appstoreconnect.apple.com)
- Create app record if not exists
- Note the Bundle ID (e.g., `com.yourcompany.taskmanager`)

#### 2. Configure In-App Purchases
Navigate to: App > Features > In-App Purchases

**Create Paid Subscription:**
```
Reference Name: Paid Yearly
Product ID: com.taskmanager.paid.yearly
Type: Auto-Renewable Subscription
Price: $19.99
Duration: 1 Year
Subscription Group: TaskManager Subscriptions
```

**Create Premium Subscription:**
```
Reference Name: Premium Yearly
Product ID: com.taskmanager.premium.yearly
Type: Auto-Renewable Subscription
Price: $99.99
Duration: 1 Year
Subscription Group: TaskManager Subscriptions
```

#### 3. Configure Server Notifications (App Store Server Notifications V2)
Navigate to: App > General > App Information

```
Server URL: https://api.yourdomain.com/api/billing/webhooks/apple
```

Notification Types to Handle:
- `SUBSCRIBED` - New subscription
- `DID_RENEW` - Successful renewal
- `DID_FAIL_TO_RENEW` - Renewal failed (billing issue)
- `DID_CHANGE_RENEWAL_STATUS` - Auto-renew toggled
- `EXPIRED` - Subscription expired
- `GRACE_PERIOD_EXPIRED` - Grace period ended
- `REFUND` - Refund issued
- `REVOKE` - Family sharing revoked

#### 4. Generate Shared Secret
Navigate to: App > In-App Purchases > App-Specific Shared Secret
- Generate and save securely (needed for receipt validation)

#### 5. Sandbox Testing
- Create sandbox tester accounts in Users and Access
- Use these accounts on test devices

### Google Play Console

#### 1. Create App
- Log into [Google Play Console](https://play.google.com/console)
- Create app if not exists
- Note the Package Name (e.g., `com.yourcompany.taskmanager`)

#### 2. Configure Subscriptions
Navigate to: Monetize > Products > Subscriptions

**Create Paid Subscription:**
```
Product ID: paid_yearly
Name: Paid Plan
Description: 5GB storage, 30-day file retention
Price: $19.99
Billing Period: Yearly
Grace Period: 7 days
```

**Create Premium Subscription:**
```
Product ID: premium_yearly
Name: Premium Plan
Description: 100GB storage, unlimited retention
Price: $99.99
Billing Period: Yearly
Grace Period: 7 days
```

#### 3. Configure Real-time Developer Notifications (RTDN)
Navigate to: Monetize > Monetization setup

```
Topic Name: projects/your-project/topics/play-billing
```

Set up Cloud Pub/Sub:
1. Create topic in Google Cloud Console
2. Create push subscription pointing to your webhook
3. Grant `google-play-developer-notifications@system.gserviceaccount.com` publish access

Webhook URL:
```
https://api.yourdomain.com/api/billing/webhooks/google
```

#### 4. Service Account for Server Verification
- Create service account in Google Cloud Console
- Download JSON key file
- Grant "View financial data" permission in Play Console

---

## Backend Implementation

### Environment Variables
Add to `.env`:
```bash
# Apple IAP
APPLE_SHARED_SECRET=your_shared_secret
APPLE_BUNDLE_ID=com.yourcompany.taskmanager
APPLE_ISSUER_ID=your_issuer_id
APPLE_KEY_ID=your_key_id
APPLE_PRIVATE_KEY_PATH=./keys/apple_private_key.p8

# Google Play Billing
GOOGLE_PACKAGE_NAME=com.yourcompany.taskmanager
GOOGLE_SERVICE_ACCOUNT_PATH=./keys/google_service_account.json
```

### API Endpoints

#### Purchase Verification
```
POST /api/billing/verify/apple
Body: { receipt: string, productId: string }
Response: { success: boolean, subscription: SubscriptionDetails }

POST /api/billing/verify/google
Body: { purchaseToken: string, productId: string }
Response: { success: boolean, subscription: SubscriptionDetails }
```

#### Webhook Handlers
```
POST /api/billing/webhooks/apple
- Receives App Store Server Notifications V2
- Validates JWT signature
- Updates subscription status

POST /api/billing/webhooks/google
- Receives RTDN via Cloud Pub/Sub
- Validates message authenticity
- Updates subscription status
```

#### Subscription Management
```
GET /api/billing/subscription
- Returns current subscription details

POST /api/billing/subscription/restore
- Restores purchases from app stores

GET /api/billing/subscription/management-url
- Returns platform-specific management URL
  - iOS: https://apps.apple.com/account/subscriptions
  - Android: https://play.google.com/store/account/subscriptions
```

### Receipt Validation Logic

#### Apple Receipt Validation
```typescript
// Using App Store Server API (recommended over deprecated verifyReceipt)
async function validateAppleReceipt(transactionId: string): Promise<SubscriptionStatus> {
  // 1. Get transaction info from App Store Server API
  // 2. Verify JWT signature using Apple's public key
  // 3. Check transaction is for our app (bundle ID)
  // 4. Extract subscription status, expiry date
  // 5. Update database
}
```

#### Google Purchase Validation
```typescript
async function validateGooglePurchase(
  productId: string,
  purchaseToken: string
): Promise<SubscriptionStatus> {
  // 1. Call Google Play Developer API
  // 2. Verify purchase is for our app (package name)
  // 3. Check subscription status
  // 4. Extract expiry time, auto-renew status
  // 5. Update database
}
```

### Webhook Processing

#### Apple Notification Handler
```typescript
async function handleAppleNotification(signedPayload: string) {
  // 1. Decode and verify JWS signature
  // 2. Extract notification type and subtype
  // 3. Get transaction info
  // 4. Map Apple product ID to our plan
  // 5. Update organization_subscriptions table
  // 6. Handle specific cases:
  //    - SUBSCRIBED: Activate subscription
  //    - DID_RENEW: Extend period
  //    - EXPIRED: Downgrade to free
  //    - REFUND: Immediate downgrade
}
```

#### Google Notification Handler
```typescript
async function handleGoogleNotification(message: PubSubMessage) {
  // 1. Decode base64 message data
  // 2. Parse SubscriptionNotification
  // 3. Fetch full subscription details from API
  // 4. Map Google product ID to our plan
  // 5. Update organization_subscriptions table
  // 6. Handle notification types:
  //    - SUBSCRIPTION_PURCHASED: Activate
  //    - SUBSCRIPTION_RENEWED: Extend period
  //    - SUBSCRIPTION_CANCELED: Mark canceled
  //    - SUBSCRIPTION_EXPIRED: Downgrade to free
}
```

### Database Updates

Add columns to `organization_subscriptions`:
```sql
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS
  original_transaction_id VARCHAR(255),  -- Apple's original transaction ID
  latest_receipt TEXT,                   -- Stored for re-validation
  auto_renew_status BOOLEAN DEFAULT true,
  billing_retry_period BOOLEAN DEFAULT false,
  grace_period_expires_at TIMESTAMP;
```

---

## Mobile Implementation

### iOS (Swift/SwiftUI)

#### StoreKit 2 Integration

```swift
// SubscriptionManager.swift
import StoreKit

class SubscriptionManager: ObservableObject {
    @Published var products: [Product] = []
    @Published var purchasedSubscriptions: [Product] = []

    private let productIds = [
        "com.taskmanager.paid.yearly",
        "com.taskmanager.premium.yearly"
    ]

    // Load products
    func loadProducts() async throws {
        products = try await Product.products(for: productIds)
    }

    // Purchase subscription
    func purchase(_ product: Product) async throws -> Transaction? {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)

            // Send to backend for verification
            await verifyWithBackend(transaction)

            await transaction.finish()
            return transaction

        case .userCancelled, .pending:
            return nil
        @unknown default:
            return nil
        }
    }

    // Verify with backend
    private func verifyWithBackend(_ transaction: Transaction) async {
        let receipt = transaction.jsonRepresentation

        // POST to /api/billing/verify/apple
        // Include: transactionId, productId, receipt
    }

    // Restore purchases
    func restorePurchases() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                await verifyWithBackend(transaction)
            }
        }
    }

    // Listen for transaction updates
    func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await self.verifyWithBackend(transaction)
                    await transaction.finish()
                }
            }
        }
    }
}
```

#### Subscription UI (SwiftUI)

```swift
// SubscriptionView.swift
struct SubscriptionView: View {
    @StateObject private var subscriptionManager = SubscriptionManager()
    @State private var selectedProduct: Product?

    var body: some View {
        VStack {
            Text("Choose Your Plan")
                .font(.title)

            ForEach(subscriptionManager.products) { product in
                SubscriptionCard(
                    product: product,
                    isSelected: selectedProduct == product,
                    onSelect: { selectedProduct = product }
                )
            }

            Button("Subscribe") {
                Task {
                    if let product = selectedProduct {
                        try? await subscriptionManager.purchase(product)
                    }
                }
            }
            .disabled(selectedProduct == nil)

            Button("Restore Purchases") {
                Task {
                    await subscriptionManager.restorePurchases()
                }
            }
        }
        .task {
            try? await subscriptionManager.loadProducts()
        }
    }
}
```

### Android (Kotlin)

#### Google Play Billing Integration

```kotlin
// BillingManager.kt
class BillingManager(private val context: Context) {
    private lateinit var billingClient: BillingClient
    private val productIds = listOf("paid_yearly", "premium_yearly")

    private val _products = MutableStateFlow<List<ProductDetails>>(emptyList())
    val products: StateFlow<List<ProductDetails>> = _products

    fun initialize() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases()
            .build()

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryProducts()
                }
            }

            override fun onBillingServiceDisconnected() {
                // Retry connection
            }
        })
    }

    private fun queryProducts() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                productIds.map { productId ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                }
            )
            .build()

        billingClient.queryProductDetailsAsync(params) { result, productDetailsList ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                _products.value = productDetailsList
            }
        }
    }

    fun purchase(activity: Activity, productDetails: ProductDetails) {
        val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken
            ?: return

        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .setOfferToken(offerToken)
                        .build()
                )
            )
            .build()

        billingClient.launchBillingFlow(activity, params)
    }

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                handlePurchase(purchase)
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            // Verify with backend
            verifyWithBackend(purchase)

            // Acknowledge purchase
            if (!purchase.isAcknowledged) {
                val params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                billingClient.acknowledgePurchase(params) { }
            }
        }
    }

    private fun verifyWithBackend(purchase: Purchase) {
        // POST to /api/billing/verify/google
        // Include: purchaseToken, productId
    }

    fun restorePurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()

        billingClient.queryPurchasesAsync(params) { result, purchases ->
            for (purchase in purchases) {
                verifyWithBackend(purchase)
            }
        }
    }
}
```

### React Native (if applicable)

```typescript
// Using react-native-iap library
import * as IAP from 'react-native-iap';

const productIds = Platform.select({
  ios: ['com.taskmanager.paid.yearly', 'com.taskmanager.premium.yearly'],
  android: ['paid_yearly', 'premium_yearly'],
});

// Initialize
await IAP.initConnection();

// Get products
const products = await IAP.getSubscriptions({ skus: productIds });

// Purchase
const purchase = await IAP.requestSubscription({ sku: productId });

// Verify with backend
await api.post('/billing/verify/' + Platform.OS, {
  receipt: Platform.OS === 'ios' ? purchase.transactionReceipt : purchase.purchaseToken,
  productId: purchase.productId,
});

// Finish transaction
await IAP.finishTransaction({ purchase });
```

---

## Testing Strategy

### Sandbox Testing

#### Apple Sandbox
1. Create sandbox tester in App Store Connect
2. Sign out of App Store on device
3. When purchasing, sign in with sandbox account
4. Subscriptions renew faster in sandbox:
   - 1 week = 3 minutes
   - 1 month = 5 minutes
   - 1 year = 1 hour

#### Google Test Tracks
1. Add test accounts in Play Console
2. Use internal testing track
3. License testing: purchases are free
4. Test subscription renewal behavior

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| New subscription | Storage limit increases, status = active |
| Subscription renewal | Period extended, no interruption |
| Subscription cancellation | Access until period end, then downgrade |
| Failed renewal | Grace period, then downgrade |
| Refund | Immediate downgrade to free |
| Restore purchases | Subscription status restored |
| Upgrade (Paid → Premium) | Immediate access to new tier |
| Downgrade (Premium → Paid) | New tier at next renewal |

### Webhook Testing

Use ngrok or similar for local webhook testing:
```bash
ngrok http 3000
# Update webhook URLs in App Store Connect / Play Console
```

---

## Launch Checklist

### Pre-Launch

- [ ] App Store Connect products created and approved
- [ ] Google Play Console subscriptions created
- [ ] Server notifications configured (both platforms)
- [ ] Backend endpoints deployed and tested
- [ ] Receipt validation working in sandbox
- [ ] Webhook handlers tested
- [ ] Mobile UI complete and tested
- [ ] Error handling and edge cases covered
- [ ] Analytics/logging in place

### App Store Review

- [ ] Subscription terms clearly displayed
- [ ] Restore purchases button visible
- [ ] Links to Terms of Service and Privacy Policy
- [ ] Subscription management instructions
- [ ] Price displayed correctly for all regions

### Go-Live

- [ ] Switch from sandbox to production endpoints
- [ ] Monitor webhook delivery
- [ ] Track conversion rates
- [ ] Monitor for failed purchases/renewals
- [ ] Customer support prepared for billing questions

---

## Resources

### Apple
- [StoreKit 2 Documentation](https://developer.apple.com/documentation/storekit)
- [App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications)

### Google
- [Google Play Billing Library](https://developer.android.com/google/play/billing)
- [Real-time Developer Notifications](https://developer.android.com/google/play/billing/rtdn-reference)
- [Google Play Developer API](https://developers.google.com/android-publisher)

### Libraries
- iOS: StoreKit 2 (native)
- Android: Google Play Billing Library 6.x
- React Native: `react-native-iap`
- Backend: `app-store-server-api` (npm), `google-auth-library` (npm)
