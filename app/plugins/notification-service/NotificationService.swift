import Intents
import UserNotifications

// 토피 알림 확장(2026-10-13) — 서버가 보낸 data의 senderName·senderImage로 카톡처럼 "보낸 사람 사진이 있는 대화 알림"
// (애플 Communication Notifications)으로 바꿔서 보여 줌. 사진을 못 받거나 실패하면 원래 알림 그대로(앱 아이콘 + 제목·본문).
// 알림 하나에 쓸 수 있는 시간은 약 30초 — 사진은 8초 안에 못 받으면 사진 없이.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    self.contentHandler = contentHandler
    let content = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
    bestAttempt = content
    let info = request.content.userInfo
    guard #available(iOS 15.0, *), let senderName = info["senderName"] as? String, !senderName.isEmpty else {
      contentHandler(content)
      return
    }
    // 같은 대화방(아티스트·CP방) 알림끼리 묶이게 대화방 id를 대화 id로
    let conversationId = (info["actorId"] as? String) ?? senderName
    let imageURL = (info["senderImage"] as? String).flatMap { URL(string: $0) }
    loadImage(imageURL) { data in
      let image = data.map { INImage(imageData: $0) }
      let sender = INPerson(
        personHandle: INPersonHandle(value: conversationId, type: .unknown),
        nameComponents: nil,
        displayName: senderName,
        image: image,
        contactIdentifier: nil,
        customIdentifier: conversationId
      )
      let intent = INSendMessageIntent(
        recipients: nil,
        outgoingMessageType: .outgoingMessageText,
        content: content.body,
        speakableGroupName: nil,
        conversationIdentifier: conversationId,
        serviceName: nil,
        sender: sender,
        attachments: nil
      )
      if let image { intent.setImage(image, forParameterNamed: \.sender) }
      let interaction = INInteraction(intent: intent, response: nil)
      interaction.direction = .incoming
      interaction.donate { _ in
        if let updated = try? content.updating(from: intent) {
          contentHandler(updated)
        } else {
          contentHandler(content)
        }
      }
    }
  }

  // 시간이 다 되면 받은 그대로라도 보여 줌(알림이 사라지지 않게)
  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttempt { contentHandler(bestAttempt) }
  }

  private func loadImage(_ url: URL?, completion: @escaping (Data?) -> Void) {
    guard let url else {
      completion(nil)
      return
    }
    var request = URLRequest(url: url)
    request.timeoutInterval = 8
    URLSession.shared.dataTask(with: request) { data, response, _ in
      let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
      completion(ok ? data : nil)
    }.resume()
  }
}
