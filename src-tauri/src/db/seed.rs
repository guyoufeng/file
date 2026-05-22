use sqlx::SqlitePool;

pub async fn restore_sample_data(pool: &SqlitePool, confirmed: bool) -> anyhow::Result<()> {
    if !confirmed {
        anyhow::bail!("恢复示例数据需要前端显式确认");
    }

    clear_existing_data(pool).await?;
    seed_categories(pool).await?;
    seed_topology(pool).await?;
    Ok(())
}

async fn clear_existing_data(pool: &SqlitePool) -> anyhow::Result<()> {
    for table in [
        "change_records",
        "connections",
        "ports",
        "alerts",
        "devices",
        "racks",
        "micro_modules",
        "rooms",
        "data_centers",
        "device_categories",
        "ai_messages",
        "ai_conversations",
        "audit_logs",
        "import_row_issues",
        "import_batches",
        "device_templates",
        "ai_model_configs",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await?;
    }

    Ok(())
}

async fn seed_categories(pool: &SqlitePool) -> anyhow::Result<()> {
    let categories = [
        (
            "server",
            "服务器",
            "server",
            r#"["物理服务器","数据库服务器","虚拟化服务器","超融合服务器"]"#,
        ),
        (
            "network",
            "网络设备",
            "network",
            r#"["核心交换机","接入交换机","路由器","负载均衡"]"#,
        ),
        (
            "security",
            "安全设备",
            "security",
            r#"["防火墙","堡垒机","入侵防护","日志审计"]"#,
        ),
        (
            "storage",
            "存储设备",
            "storage",
            r#"["SAN存储","NAS存储","备份一体机","磁带库"]"#,
        ),
        (
            "facility",
            "基础设施",
            "facility",
            r#"["列头柜","精密空调","UPS","PDU"]"#,
        ),
        (
            "patching",
            "配线设备",
            "patching",
            r#"["配线架","ODF","MDF"]"#,
        ),
        ("other", "其他设备", "other", r#"["其他"]"#),
    ];

    for (id, name, major, subtypes_json) in categories {
        sqlx::query(
            "INSERT INTO device_categories (id, name, major, subtypes_json) VALUES (?, ?, ?, ?)",
        )
        .bind(id)
        .bind(name)
        .bind(major)
        .bind(subtypes_json)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_topology(pool: &SqlitePool) -> anyhow::Result<()> {
    for (id, name, location) in [
        ("dc-nanjing", "南京", "南京"),
        ("dc-hangzhou", "杭州", "杭州"),
        ("dc-vietnam", "越南", "越南"),
    ] {
        sqlx::query("INSERT INTO data_centers (id, name, location) VALUES (?, ?, ?)")
            .bind(id)
            .bind(name)
            .bind(location)
            .execute(pool)
            .await?;
    }

    for (id, data_center_id, name, layout_type) in [
        ("room-nj-529", "dc-nanjing", "529数据中心", "micro_module"),
        ("room-nj-99", "dc-nanjing", "99数据中心", "simple_rows"),
        ("room-nj-308", "dc-nanjing", "308数据中心", "simple_rows"),
        ("room-hz-main", "dc-hangzhou", "杭州数据中心", "simple_rows"),
        ("room-vn-c7", "dc-vietnam", "越南C7数据中心", "single_rack"),
    ] {
        sqlx::query(
            "INSERT INTO rooms (id, data_center_id, name, layout_type, default_rack_height_u) VALUES (?, ?, ?, ?, 48)",
        )
        .bind(id)
        .bind(data_center_id)
        .bind(name)
        .bind(layout_type)
        .execute(pool)
        .await?;
    }

    for (id, name) in [("mm-529-a", "华为微模块A"), ("mm-529-b", "华为微模块B")] {
        sqlx::query(
            "INSERT INTO micro_modules (id, room_id, name, rows, columns) VALUES (?, 'room-nj-529', ?, 2, 10)",
        )
        .bind(id)
        .bind(name)
        .execute(pool)
        .await?;
    }

    let mut rack_index = 0_i64;
    for module in ["a", "b"] {
        for row_name in ["A排", "B排"] {
            for column in 1_i64..=10 {
                rack_index += 1;
                let module_label = module.to_uppercase();
                let row_code = if row_name == "A排" { "1" } else { "2" };
                let rack_no = format!("{module_label}{row_code}-{column:02}");
                let rack_id = format!("rack-529-{}", rack_no.to_lowercase());
                let rack_type = match column {
                    1 => "row_head",
                    9 => "patching",
                    10 => "cooling",
                    _ => "server",
                };
                let status = if module == "b" && column == 6 {
                    "alert"
                } else {
                    "normal"
                };
                let notes = if rack_type == "cooling" {
                    Some("精密空调柜位")
                } else {
                    None
                };

                insert_rack(
                    pool,
                    &rack_id,
                    "room-nj-529",
                    Some(&format!("mm-529-{module}")),
                    &format!("529-{rack_no}"),
                    rack_type,
                    row_name,
                    column,
                    status,
                    8000,
                    notes,
                )
                .await?;
                seed_devices_for_rack(pool, &rack_id, rack_index).await?;
            }
        }
    }

    for (room_id, prefix, count) in [
        ("room-nj-99", "99", 4_i64),
        ("room-nj-308", "308", 3_i64),
        ("room-hz-main", "HZ", 3_i64),
        ("room-vn-c7", "C7", 2_i64),
    ] {
        for column in 1_i64..=count {
            rack_index += 1;
            let rack_id = format!("rack-{}-{column:02}", prefix.to_lowercase());
            let rack_type = if column == count { "network" } else { "server" };
            insert_rack(
                pool,
                &rack_id,
                room_id,
                None,
                &format!("{prefix}-{column:02}"),
                rack_type,
                "A排",
                column,
                "normal",
                6000,
                None,
            )
            .await?;
            seed_devices_for_rack(pool, &rack_id, rack_index).await?;
        }
    }

    seed_alerts(pool).await
}

#[allow(clippy::too_many_arguments)]
async fn insert_rack(
    pool: &SqlitePool,
    id: &str,
    room_id: &str,
    micro_module_id: Option<&str>,
    name: &str,
    rack_type: &str,
    row_name: &str,
    column_index: i64,
    status: &str,
    power_capacity_w: i64,
    notes: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO racks (id, room_id, micro_module_id, name, type, row_name, column_index, height_u, status, power_capacity_w, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 48, ?, ?, ?)",
    )
    .bind(id)
    .bind(room_id)
    .bind(micro_module_id)
    .bind(name)
    .bind(rack_type)
    .bind(row_name)
    .bind(column_index)
    .bind(status)
    .bind(power_capacity_w)
    .bind(notes)
    .execute(pool)
    .await?;

    Ok(())
}

async fn seed_devices_for_rack(
    pool: &SqlitePool,
    rack_id: &str,
    rack_index: i64,
) -> anyhow::Result<()> {
    for (slot_index, start_u) in [42_i64, 34, 25, 14].iter().enumerate() {
        let sequence = rack_index * 4 + slot_index as i64 + 1;
        let subtype = match slot_index {
            1 => "数据库服务器",
            2 => "虚拟化服务器",
            3 => "超融合服务器",
            _ => "物理服务器",
        };
        let business_ip = format!(
            "10.{}.{}.{}",
            10 + (rack_index % 20),
            sequence / 250,
            20 + (sequence % 200)
        );
        let management_ip = format!("172.16.{}.{}", rack_index % 50, 20 + (sequence % 200));
        let ips_json = serde_json::json!([business_ip, management_ip]).to_string();
        let status = if sequence % 37 == 0 {
            "alert"
        } else {
            "normal"
        };

        sqlx::query(
            r#"
            INSERT INTO devices (
              id, rack_id, category_id, subtype, name, computer_name, business_ip, management_ip,
              ips_json, purpose, owner, vendor, model, serial_number, asset_no, warranty_expire_at,
              hardware_spec, operating_system, side, start_u, end_u, height_u, status, metadata_json
            ) VALUES (?, ?, 'server', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2028-12-31', ?, ?, 'front', ?, ?, 4, ?, '{}')
            "#,
        )
        .bind(format!("dev-{sequence:03}"))
        .bind(rack_id)
        .bind(subtype)
        .bind(format!("业务服务器-{sequence:03}"))
        .bind(format!("QF-SRV-{sequence:03}"))
        .bind(business_ip)
        .bind(management_ip)
        .bind(ips_json)
        .bind(match slot_index % 3 {
            0 => "生产业务",
            1 => "数据库服务",
            _ => "虚拟化资源池",
        })
        .bind(["张三", "李四", "王五", "赵六"][(sequence as usize) % 4])
        .bind(if slot_index % 2 == 0 { "HPE" } else { "Dell" })
        .bind(if slot_index % 2 == 0 {
            "DL380 Gen10"
        } else {
            "PowerEdge R750"
        })
        .bind(format!("SN{sequence:08}"))
        .bind(format!("IDC-SRV-{sequence:04}"))
        .bind("2CPU / 256GB RAM / 8x1.92TB SSD")
        .bind(if slot_index % 2 == 0 {
            "VMware ESXi 8"
        } else {
            "Rocky Linux 9"
        })
        .bind(*start_u)
        .bind(*start_u + 3)
        .bind(status)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_alerts(pool: &SqlitePool) -> anyhow::Result<()> {
    for index in 0_i64..12 {
        let sequence = index + 1;
        sqlx::query(
            r#"
            INSERT INTO alerts (id, device_id, source, level, status, title, description, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(format!("alert-{sequence:02}"))
        .bind(format!("dev-{sequence:03}"))
        .bind(if index % 2 == 0 { "manual" } else { "prometheus" })
        .bind(if index % 3 == 0 { "critical" } else { "warning" })
        .bind(if index % 4 == 0 {
            "acknowledged"
        } else {
            "unconfirmed"
        })
        .bind(if index % 3 == 0 {
            "物理机硬件异常"
        } else {
            "资源使用率偏高"
        })
        .bind(if index % 3 == 0 {
            "示例硬盘或电源模块告警"
        } else {
            "示例 CPU、内存或磁盘阈值告警"
        })
        .bind(format!("2026-05-{:02}T09:00:00+08:00", 10 + index))
        .execute(pool)
        .await?;
    }

    Ok(())
}
