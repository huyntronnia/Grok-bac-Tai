# Browser Automation Event Flow

Tài liệu này mô tả chi tiết luồng sự kiện (Event Flow) giữa trang web (ChatGPT), trình duyệt Chrome, hệ thống theo dõi (Monitor), và Pipeline chính.

## 1. Sơ đồ Luồng Sự kiện hiện tại (CDP Event Flow)

Sự kiện được truyền phát từ trang Web thông qua Mutation Observers, CDP Network events, và Console logs về Electron Main Process:

```mermaid
graph TD
    subgraph Browser Page Context
        mutation["DOM Mutation / Resize (chatgpt_dom.js)"]
        binding["chatgptUiMonitorBinding (Window Binding)"]
        console_log["console.error / exceptions"]
        response["HTTP Network Responses (dalle, images)"]
    end

    subgraph Electron Main Process (CDP Client)
        cdp_network["CDP 'Network.responseReceived'"]
        cdp_console["CDP 'Runtime.consoleAPICalled'"]
        cdp_exception["CDP 'Runtime.exceptionThrown'"]
        cdp_binding["CDP 'Runtime.bindingCalled'"]
        
        monitor["ChatGPTRuntimeMonitor (chatgpt_runtime_monitor.js)"]
        pipeline["Pipeline Runner (chatgpt_pipeline.js)"]
    end

    mutation -->|Trực tiếp gọi| binding
    binding -->|CDP Event| cdp_binding
    console_log -->|CDP Event| cdp_console
    console_log -->|CDP Event| cdp_exception
    response -->|CDP Event| cdp_network

    cdp_binding --> monitor
    cdp_console --> monitor
    cdp_exception --> monitor
    cdp_network --> monitor

    monitor -->|Emit 'state_changed' / 'error'| pipeline
```

## 2. Ánh xạ Sự kiện sang Playwright

Khi chuyển sang Playwright, cơ chế lắng nghe sự kiện thô của CDP sẽ được thay thế bằng các phương thức quan sát chính thức từ Playwright:

| Sự kiện CDP hiện tại | Phương thức Playwright tương ứng | Ghi chú |
| :--- | :--- | :--- |
| `Network.responseReceived` | `page.on('response', response => { ... })` | Rất ổn định, tự động parse body và headers sạch sẽ hơn CDP. |
| `Runtime.consoleAPICalled` | `page.on('console', msg => { ... })` | Tự động phân loại `log`, `error`, `warn`. |
| `Runtime.exceptionThrown` | `page.on('pageerror', err => { ... })` | Bắt lỗi Runtime JS không được xử lý trong trang. |
| `Runtime.bindingCalled` | `page.exposeFunction('name', fn)` | Đăng ký trực tiếp hàm từ Main Process vào Page. Rất dễ sử dụng, thay thế hoàn toàn cơ chế binding thô của CDP. |
| `Page.frameNavigated` | `page.on('framenavigated', frame => { ... })` | Theo dõi sự thay đổi URL của iframe và main frame. |

## 3. Cơ chế Khôi phục Sự kiện khi Mất Kết nối (Reconnection Event Flow)

Nếu kết nối Playwright bị gián đoạn:
1. `browser.on('disconnected')` sẽ được kích hoạt.
2. `ChatGPTRuntimeMonitor` chuyển trạng thái sang `DISCONNECTED`.
3. Pipeline chính nhận sự kiện ngắt kết nối, gọi `recoverCdpPageIfCrashed()`.
4. Playwright thực hiện `chromium.connectOverCDP` để kết nối lại và tái thiết lập các listeners.
