// 性能基准测试：100MB 日志搜索 + 内存测试
use oxideterm_lib::session::scroll_buffer::{ScrollBuffer, TerminalLine};
use oxideterm_lib::session::search::SearchOptions;
use std::sync::Arc;
use std::time::Instant;

#[tokio::main]
async fn main() {
    println!("=== OxideTerm Buffer Performance Benchmark ===\n");

    // 测试 1: 100MB 日志写入性能
    benchmark_large_write().await;

    // 测试 2: 搜索性能（不同缓冲区大小）
    benchmark_search_performance().await;

    // 测试 3: 内存使用测试
    benchmark_memory_usage().await;

    // 测试 4: 序列化/反序列化性能
    benchmark_serialization().await;
}

/// 测试 1: 大量日志写入性能
async fn benchmark_large_write() {
    println!("📝 Test 1: 100MB Log Write Performance");

    let buffer = Arc::new(ScrollBuffer::with_capacity(1_000_000)); // 100万行

    // 生成模拟日志行（平均每行约 100 字节）
    let line_count = 1_000_000;
    let start = Instant::now();

    for i in 0..line_count {
        let text = format!(
            "[{:06}] 2024-01-15 12:34:56.{:03} INFO  app::module - Processing request #{} with data payload and metadata",
            i, i % 1000, i
        );
        buffer.append(TerminalLine::new(text)).await;

        if i > 0 && i % 100_000 == 0 {
            let elapsed = start.elapsed();
            let throughput = (i as f64 / elapsed.as_secs_f64()) / 1000.0;
            println!(
                "  ├─ {:>7} lines: {:>6.2}s ({:>6.1}K lines/sec)",
                i,
                elapsed.as_secs_f64(),
                throughput
            );
        }
    }

    let total_elapsed = start.elapsed();
    let stats = buffer.stats().await;
    let throughput = (line_count as f64 / total_elapsed.as_secs_f64()) / 1000.0;

    println!(
        "  └─ Total: {:.2}s ({:.1}K lines/sec)",
        total_elapsed.as_secs_f64(),
        throughput
    );
    println!(
        "     Buffer: {} lines, {:.1} MB\n",
        stats.current_lines, stats.memory_usage_mb
    );
}

/// 测试 2: 搜索性能
async fn benchmark_search_performance() {
    println!("🔍 Test 2: Search Performance");

    // 创建包含 100万行的测试数据
    let buffer = Arc::new(ScrollBuffer::with_capacity(1_000_000));

    println!("  Preparing test data...");
    for i in 0..1_000_000 {
        let text = if i % 100 == 0 {
            format!("ERROR: Connection timeout at line {}", i)
        } else if i % 50 == 0 {
            format!("WARNING: Slow query detected at line {}", i)
        } else {
            format!("[{}] Regular log line with some data", i)
        };
        buffer.append(TerminalLine::new(text)).await;
    }

    let stats = buffer.stats().await;
    println!(
        "  Data ready: {} lines, {:.1} MB\n",
        stats.current_lines, stats.memory_usage_mb
    );

    // 测试不同类型的搜索
    let test_cases = vec![
        (
            "Simple literal (high frequency)",
            SearchOptions {
                query: "line".to_string(),
                case_sensitive: true,
                regex: false,
                whole_word: false,
            },
        ),
        (
            "Simple literal (low frequency)",
            SearchOptions {
                query: "ERROR".to_string(),
                case_sensitive: true,
                regex: false,
                whole_word: false,
            },
        ),
        (
            "Case insensitive",
            SearchOptions {
                query: "error".to_string(),
                case_sensitive: false,
                regex: false,
                whole_word: false,
            },
        ),
        (
            "Regex pattern",
            SearchOptions {
                query: r"^(ERROR|WARNING):".to_string(),
                case_sensitive: true,
                regex: true,
                whole_word: false,
            },
        ),
        (
            "Whole word",
            SearchOptions {
                query: "timeout".to_string(),
                case_sensitive: true,
                regex: false,
                whole_word: true,
            },
        ),
    ];

    for (name, options) in test_cases {
        let start = Instant::now();
        let result = buffer.search(options).await;
        let elapsed = start.elapsed();

        println!("  ├─ {}", name);
        println!(
            "  │  Matches: {}, Time: {:.3}s ({:.1}K lines/sec)",
            result.total_matches,
            elapsed.as_secs_f64(),
            (stats.current_lines as f64 / elapsed.as_secs_f64()) / 1000.0
        );
    }
    println!();
}

/// 测试 3: 内存使用测试
async fn benchmark_memory_usage() {
    println!("💾 Test 3: Memory Usage Analysis");

    let test_sizes = vec![
        (10_000, "10K lines (~1 MB)"),
        (100_000, "100K lines (~10 MB)"),
        (500_000, "500K lines (~50 MB)"),
        (1_000_000, "1M lines (~100 MB)"),
    ];

    for (size, label) in test_sizes {
        let buffer = Arc::new(ScrollBuffer::with_capacity(size));

        // 填充数据
        for i in 0..size {
            let text = format!("[{:06}] Log line with some data payload #{}", i, i);
            buffer.append(TerminalLine::new(text)).await;
        }

        let stats = buffer.stats().await;
        let bytes_per_line = (stats.memory_usage_mb * 1024.0 * 1024.0) / stats.current_lines as f64;

        println!("  ├─ {}", label);
        println!(
            "  │  Actual: {:.2} MB ({:.1} bytes/line)",
            stats.memory_usage_mb, bytes_per_line
        );
    }
    println!();
}

/// 测试 4: 序列化/反序列化性能
async fn benchmark_serialization() {
    println!("💿 Test 4: Serialization/Deserialization Performance");

    let buffer = Arc::new(ScrollBuffer::with_capacity(100_000));

    // 填充 10万行数据
    for i in 0..100_000 {
        let text = format!("[{:06}] Test log line with data #{}", i, i);
        buffer.append(TerminalLine::new(text)).await;
    }

    let stats = buffer.stats().await;
    println!(
        "  Buffer: {} lines, {:.2} MB",
        stats.current_lines, stats.memory_usage_mb
    );

    // 序列化
    let start = Instant::now();
    let bytes = buffer.save_to_bytes().await.unwrap();
    let serialize_time = start.elapsed();
    let compressed_mb = bytes.len() as f64 / (1024.0 * 1024.0);

    println!(
        "  ├─ Serialize: {:.3}s → {:.2} MB ({:.1}% of original)",
        serialize_time.as_secs_f64(),
        compressed_mb,
        (compressed_mb / stats.memory_usage_mb) * 100.0
    );

    // 反序列化
    let start = Instant::now();
    let restored = ScrollBuffer::load_from_bytes(&bytes).await.unwrap();
    let deserialize_time = start.elapsed();

    let restored_stats = restored.stats().await;
    println!(
        "  └─ Deserialize: {:.3}s → {} lines",
        deserialize_time.as_secs_f64(),
        restored_stats.current_lines
    );

    println!("\n=== Benchmark Complete ===");
}
