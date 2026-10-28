import FirebaseMessaging
import UserNotifications

/// Reports each alert's delivery to BigQuery, then hands the content back to
/// the system unchanged apart from an image attachment, if the payload has one.
///
/// Same order as Firebase's quickstart: the export first, because
/// `populateNotificationContent` finishes by calling the content handler and
/// the system may end the extension right after. The export needs no
/// `FirebaseApp.configure()`: it reads the sender id, message id and
/// installation id from the payload itself.
class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard let bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    Messaging.serviceExtension()
      .exportDeliveryMetricsToBigQuery(withMessageInfo: request.content.userInfo)
    Messaging.serviceExtension()
      .populateNotificationContent(bestAttemptContent, withContentHandler: contentHandler)
  }

  /// The system is about to end the extension (an image download took too
  /// long). Show what we have rather than let it fall back to the raw payload.
  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}
