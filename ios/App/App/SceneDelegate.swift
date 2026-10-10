import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Cold launch from a home-screen quick action.
        if let item = connectionOptions.shortcutItem { openShortcut(item) }
    }

    // Quick action while the app is already running.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(openShortcut(shortcutItem))
    }

    /// Quick action types are the app's own deep links (Info.plist), so they take the same path as a
    /// kartlimitlerim:// URL: the App plugin's appUrlOpen event, or getLaunchUrl on a cold launch.
    @discardableResult
    private func openShortcut(_ item: UIApplicationShortcutItem) -> Bool {
        guard let url = URL(string: item.type) else { return false }
        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
