import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // UIWindow خلفيتها سوداء افتراضياً. contentInset:"automatic" بإعدادات
        // Capacitor يبعّد محتوى الويب عن حواف الشاشة (الشريط العلوي وخط الهوم)،
        // فتنكشف هذي الخلفية السوداء بدل لون التطبيق — نطابقها بلون الأشرطة
        // العلوية/السفلية (rgba(249,249,249)) عشان ما تبين كخط أو شريط أسود.
        window?.backgroundColor = UIColor(red: 249/255, green: 249/255, blue: 249/255, alpha: 1)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
