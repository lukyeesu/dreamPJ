สถาปัตยกรรมระบบย้ายฐานข้อมูล Google Sheets สู่ Supabase

ยุทธศาสตร์ Local-First + Zero-Egress Architecture (จำกัดโควต้า 5GB/เดือน สู่การประหยัด 99.8%)

เป้าหมายโครงการ: ย้ายระบบจัดเก็บข้อมูลจาก Google Sheets สู่ Supabase โดยยังคงใช้ Google Drive จัดเก็บไฟล์รูปภาพ/สลิปตามเดิม พร้อมวางระบบเครือข่ายและสถาปัตยกรรมข้อมูลเพื่อควบคุม Egress Outbound Data Transfer ให้อยู่ต่ำกว่า 5GB/เดือน อย่างเด็ดขาด รองรับข้อมูลนับล้านแถวโดยที่ฝั่ง Client (หน้าบ้าน) ตอบสนองได้ในระดับ Milliseconds และประหยัด RAM บนอุปกรณ์สเปกต่ำ

สารบัญ

การแปลงข้อกำหนดทางธุรกิจสู่ศัพท์วิศวกรรมสถาปัตยกรรมระบบ (Engineering Terminology Mapping)

ภาพรวมสถาปัตยกรรม (System Architecture Diagram)

รวม 20 เทคนิคระดับวิศวกรรมเพื่อลด Egress และภาระเครื่องลูกข่าย (20 Architectural Optimization Techniques)

โครงสร้างฐานข้อมูลและฟังก์ชัน Supabase PostgreSQL (Database Schema & RPC)

อัลกอริทึมการซิงก์ข้อมูลฝั่งหน้าบ้าน (Local-First IndexedDB Delta-Sync Engine)

การจัดการ Bug, ข้อจำกัดทางเทคนิค และความเสี่ยงในอนาคต (Bug Fixes & Risk Mitigation Strategy)

แผนปฏิบัติการย้ายระบบเป็นระยะ (Phased Migration Roadmap)

1. การแปลงข้อกำหนดทางธุรกิจสู่ศัพท์วิศวกรรมสถาปัตยกรรมระบบ (Engineering Terminology Mapping)

ตารางเปรียบเทียบคำอธิบายของผู้ใช้กับคำศัพท์มาตรฐานทางวิศวกรรมซอฟต์แวร์ (Software & Systems Architecture Standards) เพื่อให้การจัดทำเอกสารและสื่อสารทางเทคนิคมีความแม่นยำสูงสุด:

ลำดับ

สิ่งที่ผู้ใช้ต้องการ (User Requirements)

ศัพท์เฉพาะทางวิศวกรรม (Engineering Terms)

คำอธิบายเชิงสถาปัตยกรรม (Architectural Definition)

1

เก็บข้อมูลถาวรในเครื่องเป็นแคช 1 ชุดบน IndexedDB

Local-First Architecture with Persistent Storage Engine

การใช้ IndexedDB ภายในเบราว์เซอร์เป็นฐานข้อมูลหลักชุดแรก (Primary Source of Truth for UI) ทำให้หน้าบ้านอ่านข้อมูลได้ทันทีแบบ $0$ Latency และ $0$ Network Egress

2

ยิงข้อมูลไปเช็คแทนการดึง ถ้ามีอัปเดตดึงแค่แถวนั้น

Incremental Delta Synchronization via High-Water Mark (Timestamp/Version Vector)

การซิงก์เฉพาะข้อมูลที่มีการเปลี่ยนแปลง (Delta/Diff) โดยฝั่ง Client จะส่งค่า $\max(\text{updated\_at})$ ล่าสุดขึ้นไปถามเซิร์ฟเวอร์ เซิร์ฟเวอร์จะคิวรีเฉพาะเรคคอร์ดที่ $\text{updated\_at} > \text{high\_water\_mark}$ ส่งกลับมาเท่านั้น

3

ไม่ต้องดึงมาโชว์ทั้งหมด เปิดเจอค่อยเรียกใช้ (Lazy/Infinite Scroll)

DOM Virtualization with Cursor-based Keyset Pagination & Lazy Projection

การเรนเดอร์เฉพาะแถวที่ปรากฏใน Viewport ของจอภาพ (Virtual DOM) ควบคู่กับการดึงข้อมูลแบบ Cursor ($\text{WHERE id} > \text{last\_seen\_id LIMIT 20}$) แทนการใช้ Offset ที่กินโหลดฐานข้อมูล

4

หน้าสรุป/วิเคราะห์ ให้เซิร์ฟเวอร์คิดเลขมาให้ ส่งมาแค่ตัวเลข

Push-Down Aggregations / Compute-at-Rest via PostgreSQL RPC & Materialized Views

การผลักดันภาระการคำนวณ (Aggregations: $\text{SUM}$, $\text{COUNT}$, $\text{AVG}$) ไปประมวลผลที่ Database Engine โดยตรง และส่งกลับมาเฉพาะตัวเลขผลลัพธ์เชิงสเกลาร์ (Scalar Metric Payload) ไม่ส่ง Raw Records ข้ามเครือข่าย

5

ย้าย DB ไป Supabase แต่เก็บรูปไว้บน Google Drive เหมือนเดิม

Decoupled Binary Storage Strategy (Zero-Egress Object Storage Offload)

การแยกข้อมูลเชิงสัมพันธ์ (Metadata/Relational Data) ออกจากไฟล์มัลติมีเดียไบนารี (BLOBs) โดย Supabase จะเก็บเฉพาะ URI/Google Drive File ID ทำให้ Egress ของฐานข้อมูลแทบไม่ถูกแตะต้องเลย

2. ภาพรวมสถาปัตยกรรม (System Architecture Diagram)

flowchart TD
    subgraph Client_Browser["💻 หน้าบ้าน (Client WebApp - Local-First Engine)"]
        UI["🖥️ UI Components / Virtual List"]
        LocalCache["📦 IndexedDB (Dexie.js Persistent Cache)"]
        SyncEngine["⚙️ Background Delta-Sync Worker"]
        DriveDirect["🖼️ Google Drive Thumbnail Engine (CacheStorage)"]
    end

    subgraph Supabase_Cloud["⚡ Supabase Cloud (PostgreSQL Engine)"]
        PostgREST["🌐 PostgREST API (Brotli/Gzip)"]
        RPC_Agg["🧮 Compute-at-Rest RPC (SUM / KPI Engine)"]
        DeltaQuery["🔍 High-Water Mark Delta Filter"]
        Tombstone["🗑️ Deleted Records (Tombstone Table)"]
        DB[(🗄️ PostgreSQL Database)]
    end

    subgraph Google_Cloud["☁️ Google Drive (Media Storage)"]
        GDrive[(📂 Google Drive API / CDN Thumbnails)]
    end

    %% Read Operations
    UI -->|"1. Instant Read (0ms / 0 Egress)"| LocalCache
    LocalCache -.->|"2. Render Viewport Data"| UI

    %% Media Operations
    UI -->|"Direct Image Load via File ID (0 Supabase Egress)"| DriveDirect
    DriveDirect <-->|"lh3.googleusercontent.com (CDN)"| GDrive

    %% Sync Operations
    SyncEngine -->|"3. Ping Checksum / max(updated_at)"| DeltaQuery
    DeltaQuery -->|"4. Return Delta Rows Only (Tiny Payload)"| SyncEngine
    SyncEngine -->|"5. Upsert to Local Storage"| LocalCache
    Tombstone -->|"6. Purge Deleted IDs"| SyncEngine

    %% Analytics Operations
    UI -->|"7. Request KPI/Summary"| RPC_Agg
    RPC_Agg -->|"8. Execute SQL SUM() on DB"| DB
    RPC_Agg -->|"9. Return Aggregated Scalar Number (50 Bytes)"| UI



3. รวม 20 เทคนิคระดับวิศวกรรมเพื่อลด Egress และภาระเครื่องลูกข่าย (20 Architectural Optimization Techniques)

นอกเหนือจาก 5 แนวคิดหลักของคุณ นี่คือ 20 เทคนิคเฉพาะทางที่วิศวกรซอฟต์แวร์ระดับอาวุโสใช้ในการบีบอัดและควบคุม Egress บน Supabase Free Tier (5GB/เดือน) ให้เหลือใช้งานไม่ถึง 100MB/เดือน แม้จะมีข้อมูลมหาศาล:

หมวดที่ 1: การลดขนาด Payload ที่ระดับฐานข้อมูลและ API (Database & Query Projection)

Column Projection (Selective Sparse Fieldsets)

หลักการ: ห้ามใช้ SELECT * เด็ดขาด ทุกคำขอในหน้าตารางหรือหน้ารายการ ให้ระบุเฉพาะคอลัมน์ที่จำเป็นต่อการแสดงผลการ์ด เช่น .select('id, name, deal_status, project_date, wage')

ผลลัพธ์: ลดขนาดข้อมูลต่อแถวลงได้ $70\% - 85\%$ เมื่อเทียบกับการดึงข้อมูลทั้งหมดที่มีทั้ง Notes, Customer Address, Slips, Images

Deferred Detail Loading (การแยกดึงข้อมูลก้อนใหญ่เมื่อเปิด Modal เท่านั้น)

หลักการ: คอลัมน์ประเภทข้อความยาว เช่น note, quotation_items (JSONB), customer_address, หรือประวัติแก้ไข ให้ไม่โหลดมาในรายการหน้าแรก เมื่อผู้ใช้คลิก "แก้ไข" หรือ "ดูรายละเอียด" ของใบงานนั้นๆ จึงค่อยยิงคิวรีเดี่ยวแบบ $\text{WHERE id} = \text{:id}$ ดึงรายละเอียด

ผลลัพธ์: ประหยัดแบนด์วิดท์มหาศาล เพราะผู้ใช้ไม่ได้เปิดดูรายละเอียดลึกของทุกงานพร้อมกัน

Short Keys & Array Serialization ใน RPC Output

หลักการ: เมื่อต้องดึงข้อมูลหลายแถวผ่าน RPC ให้ฟังก์ชัน PostgreSQL ส่งกลับมาในรูปแบบ Compact Array เช่น [id, status_code, total_amount] แทนที่จะส่ง JSON Object ซ้ำๆ ที่มี Key ยาวๆ เช่น [{"transaction_id": 1, "deal_status": 2, "total_quotation_amount": 100}]

ผลลัพธ์: ตัด Overhead ของ JSON Keys ทิ้ง ประหยัด Egress ได้อีก $30\% - 40\%$

Materialized Views with Periodic Cron Refresh สำหรับหน้าวิเคราะห์

หลักการ: สร้าง MATERIALIZED VIEW ใน PostgreSQL สำหรับสรุปยอดรายวัน รายเดือน รายปี โดยตั้ง pg_cron ให้รันคำนวณเก็บไว้ล่วงหน้า เมื่อหน้า Analytics ถูกเปิด Client จะอ่านผลลัพธ์ที่คำนวณเสร็จแล้วทันที $1$ แถว ไม่เกิด CPU Spike และส่งกลับเพียงไม่กี่ไบต์

Tombstone Architecture สำหรับการตรวจสอบข้อมูลที่ถูกลบ

หลักการ: เมื่อมีการลบข้อมูล ห้ามให้หน้าบ้านดึง ID ทั้งหมดมาเปรียบเทียบว่า ID ไหนหายไป (เพราะจะเปลือง Egress มหาศาลเมื่อมีหลายหมื่น ID) แต่ให้ใช้ตาราง deleted_records(id, record_id, table_name, deleted_at) เมื่อซิงก์ หน้าบ้านเพียงแค่ถามว่า $\text{SELECT record\_id FROM deleted\_records WHERE deleted\_at} > \text{:last\_sync}$ แล้วตามไปลบใน IndexedDB ท้องถิ่น

หมวดที่ 2: โปรโตคอลเครือข่ายและการบีบอัดข้อมูล (Network, Transport & Serialization)

บังคับใช้ Brotli Compression (Content-Encoding: br)

หลักการ: PostgREST และ Cloudflare ของ Supabase รองรับ Brotli ซึ่งบีบอัดข้อความ JSON ได้แน่นกว่า Gzip ถึง $15\% - 25\%$ ตรวจสอบให้ Header ของ Client มี Accept-Encoding: gzip, deflate, br เสมอ

HTTP Conditional Requests with ETags (304 Not Modified)

หลักการ: การดึงข้อมูลที่มีการ Cache ฝั่ง Edge จะมี Header If-None-Match แนบไปด้วย หากข้อมูลยังไม่มีการเปลี่ยนแปลง เซิร์ฟเวอร์จะตอบกลับด้วยรหัสสถานะ 304 Not Modified โดยมีขนาด Body เท่ากับ 0 Bytes

Hash Checksum Handshake ก่อนเริ่มการซิงก์ (Fingerprint Ping)

หลักการ: ให้ฝั่ง Supabase มีฟังก์ชัน RPC เล็กๆ ที่คืนค่า $\text{MD5}(\max(\text{updated\_at}) \parallel \text{COUNT}(*))$ ส่งขนาดเพียง $32$ ตัวอักษร หน้าบ้านจะยิงมาเช็คค่านี้ก่อน หากค่าตรงกับ Checksum ในเครื่อง แปลว่าไม่มีข้อมูลใหม่เลย $100\%$ จึงยุติการซิงก์ทันที (ใช้ Egress ไม่ถึง $100$ ไบต์)

Payload Quantization & Precision Truncation ในตัวเลขการเงิน

หลักการ: ในการดึงข้อมูลสรุปทางสถิติ ทศนิยมที่เกินความจำเป็นให้ถูกตัดทิ่งที่ SQL ($\text{ROUND}(val, 2)$) และแปลง Timestamp ให้อยู่ในรูป Unix Epoch Milliseconds (เลขจำนวนเต็ม) แทน ISO 8601 String ยาวๆ ช่วยลดขนาด Payload รวม

หมวดที่ 3: ระบบประสานข้อมูลและการตรวจจับความเปลี่ยนแปลง (Sync & Event-Driven Engine)

Supabase Realtime with Strict Row-Level Filtering

หลักการ: หากใช้ Supabase Realtime (WebSocket) ห้าม Subscribe ทั้งตารางแบบเปิดกว้าง แต่ให้ใช้ Filter เช่น filter: 'deal_status=eq.operating' และตั้งค่าให้ Broadcast เฉพาะ EventType กับ ID สั้นๆ (ไม่ส่ง Payload ทั้งแถวมาใน WebSocket) เพื่อให้หน้าบ้านรับสัญญาณแล้วไปดึงเฉพาะแถวนั้นมาลง IndexedDB

Client-Side Optimistic UI with Write-Through Queue

หลักการ: เมื่อผู้ใช้กดบันทึกหรือแก้ไขงาน ให้เขียนลง IndexedDB ทันทีและแสดงผลสำเร็จบน UI ทันที ($0\text{ms}$) จากนั้นใส่คำสั่งลงในคิว sync_queue ในเครื่อง เพื่อรอส่งขึ้น Supabase ในพื้นหลัง หากอินเทอร์เน็ตหลุด ระบบยังทำงานต่อได้แบบ $100\%$ Offline

Mutation Batching & Debouncing

หลักการ: รวบรวมคำขอแก้ไขหลายๆ รายการที่เกิดขึ้นในเวลาใกล้เคียงกัน (เช่น ผู้ใช้แก้สถานะหลายแถวติดต่อกัน) แล้วส่งขึ้นไปใน Transaction เดียวผ่าน Supabase RPC bulk_upsert แทนการยิงแยกหลาย Request ซึ่งช่วยประหยัดทั้ง HTTP Overhead และ Database Connections

Dynamic Polling Backoff & Tab Visibility Awareness

หลักการ: ใช้ document.visibilityState หากผู้ใช้สลับหน้าต่าง หรือไม่ได้ใช้งานเว็บ ให้หยุดกระบวนการซิงก์ข้อมูลทันที และเมื่อเปิดแท็บกลับมา ค่อยยิงเช็ค Checksum เพียงครั้งเดียว ช่วยตัดการรั่วไหลของ Egress จากแท็บที่เปิดทิ้งไว้ข้ามคืน

หมวดที่ 4: การจัดการไฟล์มีเดียและรูปภาพ (Decoupled Media & Zero-Egress Storage)

Direct CDN Thumbnail via Google Drive Size Query Parameter

หลักการ: การแสดงรูปตัวอย่างบนหน้ารายการ ห้ามโหลดไฟล์รูปขนาดเต็ม ให้แปลง Google Drive ID เป็น URL ชนิด Thumbnail พิเศษ เช่น https://lh3.googleusercontent.com/d/{FILE_ID}=w200-h260-n ซึ่ง Google CDN จะย่อรูปเหลือขนาดเพียง $10-20\text{KB}$ ต่อรูป และแบนด์วิดท์ทั้งหมดจะวิ่งผ่าน Google โดยไม่ผ่าน Supabase เลยแม้แต่นิดเดียว ($0\%$ Egress)

Client-Side WebP/AVIF Image Pre-Compression ก่อนส่งขึ้น Google Drive

หลักการ: ก่อนอัปโหลดรูปภาพอ้างอิงหรือสลิปขึ้น Google Drive ให้ใช้ HTML5 Canvas หรือ Browser WebWorker บีบอัดรูปภาพให้เป็นฟอร์แมต WebP ขนาดความกว้างไม่เกิน $1200\text{px}$ (ขนาดไฟล์ไม่เกิน $150-250\text{KB}$) ทำให้การดึงกลับมาดูในอนาคตใช้เวลารวดเร็วและประหยัดเน็ตผู้ใช้

Tier-2 CacheStorage สำหรับไฟล์รูปภาพในเบราว์เซอร์

หลักการ: ใช้ Service Worker หรือ caches.open('image-cache-v1') ดักจับรูปที่เคยโหลดแล้ว เมื่อผู้ใช้เลื่อนดูรูปเดิม หรือเปิด Modal รูปใบเดิม จะถูกอ่านจาก Local Disk Cache ของเครื่องผู้ใช้ทันที ไม่มีการส่ง HTTP Request ซ้ำไปที่ Google Drive

หมวดที่ 5: สถาปัตยกรรมข้อมูลฝั่ง Client และการจัดการหน่วยความจำ (Client Memory & Data Life-Cycle)

Local In-Memory Indexing & Client-Side Full-Text Search (Dexie.js)

หลักการ: ช่องค้นหาหลัก (Search Bar) ของระบบ เช่น ค้นหาชื่อลูกค้า, เบอร์โทร, เลขที่โปรเจกต์ หรือหมวดหมู่ ให้ค้นหาจาก IndexedDB ในเครื่องโดยตรง $100\%$, ไม่ต้องส่ง Request ไปยิง $\text{LIKE } \%...\%$ ที่ Supabase

ผลลัพธ์: ความเร็วในการค้นหาลดลงเหลือ $1-5\text{ms}$ และตัดค่า Egress จากการค้นหาทั้งหมดให้กลายเป็น 0 ไบต์

Cold Data Partitioning & Archived Records Policy

หลักการ: ข้อมูลงานที่มีสถานะเสร็จสิ้นและปิดยอดเกิน $6-12$ เดือน ให้ถูกจัดเป็น "ข้อมูลประวัติ (Archived Records)" ซึ่งการซิงก์ปกติจะดึงเฉพาะ "งานปัจจุบัน (Active Projects)" เท่านั้น หากต้องการดูงานเก่า จะมีปุ่ม "ค้นหาข้อมูลในคลังประวัติ" แยกเฉพาะ ช่วยให้ขนาด IndexedDB ในเครื่องมีขนาดกะทัดรัด (ไม่เกิน $20-30\text{MB}$)

Local-First Pagination & Viewport Slicing

หลักการ: หน้าบ้านทำการแบ่งหน้าหรือ Infinite Scroll โดยการคิวรีจาก IndexedDB ท้องถิ่น ($\text{db.projects.offset(x).limit(20)}$) ทำให้อุปกรณ์สเปกต่ำไม่ต้องเก็บ Object หลายหมื่นตัวไว้ใน JavaScript Heap Memory ป้องกันอาการแอปเด้งหรือเบราว์เซอร์ค้าง (Memory Leak Prevention)

Stale-While-Revalidate (SWR) Engine with Background Reconciliation

หลักการ: เมื่อเปิดหน้าจอใดๆ ให้แสดงข้อมูลจาก IndexedDB ในทันทีแบบไม่มี Loading Spinner (Stale) จากนั้นในพื้นหลัง ระบบจะเช็ค High-Water Mark กับ Supabase อย่างเงียบๆ หากพบแถวที่อัปเดต ค่อยนำมา Merge ลง Local DB และสะท้อนขึ้น UI แบบนุ่มนวล

4. โครงสร้างฐานข้อมูลและฟังก์ชัน Supabase PostgreSQL (Database Schema & RPC)

เพื่อให้ระบบทำงานสอดคล้องกับแนวคิด Compute-at-Rest และ Incremental Delta Sync อย่างสมบูรณ์ ฐานข้อมูล PostgreSQL บน Supabase จะถูกออกแบบดังนี้:

4.1 ตารางข้อมูลหลัก (projects) และตารางติดตามการลบ (deleted_records)

-- เปิดใช้ส่วนขยาย UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ตารางหลักสำหรับเก็บข้อมูลงาน (Projects)
CREATE TABLE public.projects (
    id TEXT PRIMARY KEY,                       -- เช่น 'P-0309'
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Backdrop',
    project_datetime TIMESTAMPTZ,
    payment_date DATE,
    artist_name TEXT,
    deal_status TEXT NOT NULL DEFAULT 'operating',
    transport_status TEXT NOT NULL DEFAULT 'preparing',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    
    -- ข้อมูลลูกค้า (จัดเก็บแบบ JSONB หรือคอลัมน์แยก)
    customer_name TEXT,
    customer_phone TEXT,
    customer_info JSONB DEFAULT '{}'::jsonb,
    
    -- ข้อมูลการจัดส่ง
    recipient_name TEXT,
    recipient_phone TEXT,
    location_name TEXT,
    map_link TEXT,
    
    -- การเงินสรุปยอด (คำนวณและเก็บระดับแถวเพื่อคิวรีได้เร็ว)
    wage NUMERIC(12,2) DEFAULT 0,
    delivery_fee NUMERIC(12,2) DEFAULT 0,
    deposit_amount NUMERIC(12,2) DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_expenses NUMERIC(12,2) DEFAULT 0,
    net_profit NUMERIC(12,2) DEFAULT 0,
    customer_support_total NUMERIC(12,2) DEFAULT 0,
    
    -- ข้อมูลรายละเอียดลึก (Deferred Columns - โหลดเมื่อเปิดดูเท่านั้น)
    note TEXT,
    quotation_items JSONB DEFAULT '[]'::jsonb,
    customer_support_items JSONB DEFAULT '[]'::jsonb,
    expenses JSONB DEFAULT '[]'::jsonb,
    
    -- อ้างอิงไฟล์มีเดีย (เก็บเฉพาะ Google Drive File IDs / URLs)
    images JSONB DEFAULT '[]'::jsonb,          -- Array ของ Drive File IDs/URLs
    slips JSONB DEFAULT '[]'::jsonb,           -- Array ของ Drive File IDs/URLs
    
    -- ตัวชี้วัดการเปลี่ยนแปลงเพื่อใช้ทำ Delta Sync & Optimistic Locking
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ดัชนีเพื่อการค้นหาและการซิงก์แบบความเร็วสูง (High-Performance Indexes)
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX idx_projects_deal_status ON public.projects(deal_status);
CREATE INDEX idx_projects_payment_status ON public.projects(payment_status);
CREATE INDEX idx_projects_project_datetime ON public.projects(project_datetime DESC);

-- Trigger อัปเดต updated_at และ version อัตโนมัติทุกครั้งที่มีการ UPDATE แถว
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. ตาราง Tombstone บันทึกประวัติแถวที่ถูกลบ (สำหรับซิงก์การลบลง IndexedDB)
CREATE TABLE public.deleted_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL DEFAULT 'projects',
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_deleted_records_deleted_at ON public.deleted_records(deleted_at DESC);

-- Trigger เมื่อมีการลบข้อมูลใน projects ให้เพิ่มประวัติลง deleted_records
CREATE OR REPLACE FUNCTION record_project_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.deleted_records (record_id, table_name, deleted_at)
    VALUES (OLD.id, 'projects', timezone('utc'::text, now()));
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_project_deletion
AFTER DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION record_project_deletion();



4.2 ฟังก์ชันคำนวณผลสรุปที่เซิร์ฟเวอร์ (Push-Down Aggregation RPC)

แทนที่จะดึงข้อมูล $1,000,000$ แถวมาคำนวณที่เครื่องลูกข่าย ฟังก์ชันนี้จะประมวลผลบน RAM ของเซิร์ฟเวอร์ และส่งผลลัพธ์กลับมาเพียง 1 ก้อนขนาดไม่เกิน 150 Bytes:

CREATE OR REPLACE FUNCTION get_financial_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_deal_status TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_orders', COUNT(*),
        'total_customer_support', COALESCE(SUM(customer_support_total), 0),
        'total_revenue', COALESCE(SUM(wage + delivery_fee), 0),
        'total_expenses', COALESCE(SUM(total_expenses), 0),
        'total_net_profit', COALESCE(SUM(net_profit), 0),
        'paid_orders_count', COUNT(*) FILTER (WHERE payment_status = 'paid'),
        'unpaid_orders_count', COUNT(*) FILTER (WHERE payment_status = 'unpaid'),
        'total_unpaid_amount', COALESCE(SUM(wage + delivery_fee - deposit_amount) FILTER (WHERE payment_status = 'unpaid'), 0)
    ) INTO result
    FROM public.projects
    WHERE (p_start_date IS NULL OR project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR project_datetime <= p_end_date)
      AND (p_category IS NULL OR category = p_category)
      AND (p_deal_status IS NULL OR deal_status = p_deal_status);

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;



4.3 ฟังก์ชันคิวรีเฉพาะแถวที่มีการเปลี่ยนแปลง (Incremental Delta Fetch RPC)

ฟังก์ชันนี้รับค่า High-Water Mark (last_synced_at) จาก Client และส่งกลับเฉพาะเรคคอร์ดที่มีการอัปเดต โดยคัดเลือกเฉพาะคอลัมน์แสดงผล (Sparse Projection):

CREATE OR REPLACE FUNCTION get_project_deltas(
    p_last_synced_at TIMESTAMPTZ,
    p_limit INT DEFAULT 200
)
RETURNS JSON AS $
DECLARE
    updated_rows JSON;
    deleted_ids JSON;
    new_watermark TIMESTAMPTZ;
    rows_count INT := 0;
    has_more BOOLEAN := false;
    max_updated TIMESTAMPTZ;
    requires_full_resync BOOLEAN := false;
BEGIN
    -- 1. ป้องกันปัญหา Zombie Record: หาก Client ออฟไลน์นานเกินอายุ Tombstone (30 วัน)
    -- ประวัติการลบจะตกหล่นไปแล้ว จึงส่งสัญญาณให้ Client ล้างแคชเครื่องแล้วดึงใหม่ทั้งชุด
    IF p_last_synced_at < (NOW() - INTERVAL '30 days') THEN
        requires_full_resync := true;
    END IF;

    -- 2. ดึงเฉพาะแถวที่มีการสร้างหรือแก้ไขใหม่หลังจาก Watermark เดิม
    WITH delta_projects AS (
        SELECT 
            id, name, category, project_datetime, payment_date,
            artist_name, deal_status, transport_status, payment_status,
            customer_name, customer_phone,
            recipient_name, recipient_phone, location_name, map_link,
            wage, delivery_fee, deposit_amount,
            customer_support_total, total_expenses, net_profit,
            images, slips, version, updated_at
        FROM public.projects
        WHERE updated_at > p_last_synced_at
        ORDER BY updated_at ASC
        LIMIT p_limit
    )
    SELECT 
        COALESCE(json_agg(t), '[]'::jsonb),
        COUNT(*),
        MAX(t.updated_at)
    INTO updated_rows, rows_count, max_updated
    FROM delta_projects t;

    -- 3. ดึงรายการ ID ที่ถูกลบออกไปเพื่อนำไปลบใน IndexedDB ของ Client
    SELECT COALESCE(json_agg(record_id), '[]'::jsonb) INTO deleted_ids
    FROM (
        SELECT record_id
        FROM public.deleted_records
        WHERE deleted_at > p_last_synced_at
        ORDER BY deleted_at ASC
        LIMIT p_limit
    ) d;

    -- 4. ตรวจสอบว่ายังมีข้อมูลตกค้างอีกหรือไม่ (Cursor Pagination Check)
    IF rows_count = p_limit THEN
        has_more := true;
        -- สำคัญมาก: หากยังมีแถวถัดไป Watermark ต้องเป็นเวลาของแถวสุดท้ายใน Chunk นี้เท่านั้น (ห้ามใช้ now() เด็ดขาด มิฉะนั้นข้อมูลแถวที่เหลือจะตกหล่น)
        new_watermark := max_updated;
    ELSE
        has_more := false;
        -- หากหมด Chunk สุดท้ายแล้ว จึงค่อยขยับ Watermark เป็นเวลาปัจจุบันของเซิร์ฟเวอร์
        new_watermark := timezone('utc'::text, now());
    END IF;

    RETURN json_build_object(
        'requires_full_resync', requires_full_resync,
        'has_more', has_more,
        'new_watermark', new_watermark,
        'records', updated_rows,
        'deleted_ids', deleted_ids
    );
END;
$ LANGUAGE plpgsql STABLE;



5. อัลกอริทึมการซิงก์ข้อมูลฝั่งหน้าบ้าน (Local-First IndexedDB Delta-Sync Engine)

ใช้ไลบรารีขนาดเล็กและมีประสิทธิภาพสูงอย่าง Dexie.js (ขนาดเพียง $16\text{KB}$ Gzip) เพื่อจัดการฐานข้อมูล IndexedDB ในเบราว์เซอร์:

5.1 โครงสร้างฐานข้อมูลท้องถิ่น (Local Dexie Schema)

// src/services/localDatabase.js
import Dexie from 'dexie';

export const db = new Dexie('Flower2UDatabase');

// นิยามเฉพาะฟิลด์ที่ต้องการทำดัชนี (Index) สำหรับค้นหาเร็ว
db.version(1).stores({
  projects: 'id, name, category, project_datetime, deal_status, payment_status, customer_name, customer_phone, updated_at',
  sync_metadata: 'key', // เก็บ watermark เช่น last_synced_at
  sync_queue: '++auto_id, project_id, operation, payload, created_at' // สำหรับเขียนออฟไลน์
});



5.2 ฟังก์ชัน Background Delta-Sync Engine พร้อม Server Watermark Handling

// src/services/syncEngine.js
import { db } from './localDatabase';
import { supabase } from './supabaseClient';

export async function performDeltaSync() {
  try {
    // 1. อ่าน High-Water Mark ล่าสุดจาก Local Storage
    const meta = await db.sync_metadata.get('last_synced_at');
    let lastSyncedAt = meta ? meta.value : new Date(0).toISOString();

    let hasMore = true;
    let totalSynced = 0;
    let totalPruned = 0;

    // 2. วนลูปดึงทีละ Chunk จนกว่าข้อมูลจะครบสมบูรณ์ 100% (ป้องกันข้อมูลหล่นหายเมื่อมีอัปเดตเกิน 200 แถว)
    while (hasMore) {
      const { data, error } = await supabase.rpc('get_project_deltas', {
        p_last_synced_at: lastSyncedAt,
        p_limit: 200 // จำกัด Chunk size ป้องกัน Payload บวม
      });

      if (error) throw error;
      if (!data) break;

      const { requires_full_resync, has_more, new_watermark, records, deleted_ids } = data;

      // กรณีที่ 1: เครื่องนี้ไม่ได้เปิดนานเกิน 30 วันจน Tombstone ถูกล้างไปแล้ว -> บังคับทำ Full Resync เพื่อล้าง Zombie records
      if (requires_full_resync) {
        console.warn('[SyncEngine] Local cache too stale (>30 days). Performing clean full resync...');
        await db.projects.clear();
        lastSyncedAt = new Date(0).toISOString();
        continue;
      }

      // กรณีที่ 2: นำการเปลี่ยนแปลงมา Merge ลง IndexedDB ภายในเครื่อง
      await db.transaction('rw', db.projects, db.sync_metadata, async () => {
        if (records && records.length > 0) {
          await db.projects.bulkPut(records);
          totalSynced += records.length;
        }

        if (deleted_ids && deleted_ids.length > 0) {
          await db.projects.bulkDelete(deleted_ids);
          totalPruned += deleted_ids.length;
        }

        // อัปเดต Server Watermark ตามที่เซิร์ฟเวอร์คำนวณให้
        await db.sync_metadata.put({ key: 'last_synced_at', value: new_watermark });
      });

      lastSyncedAt = new_watermark;
      hasMore = has_more; // ถ้า true จะวนลูปดึง Chunk ถัดไปทันที
    }

    if (totalSynced > 0 || totalPruned > 0) {
      console.log(`[SyncEngine] Delta sync finished: ${totalSynced} updated, ${totalPruned} pruned.`);
    }
  } catch (err) {
    console.error('[SyncEngine] Sync error:', err);
  }
}



6. การจัดการ Bug, ข้อจำกัดทางเทคนิค และความเสี่ยงในอนาคต (Bug Fixes & Risk Mitigation Strategy)

เพื่อป้องกันข้อผิดพลาดเชิงระบบขณะใช้งานจริง (Runtime, Concurrency & Edge Cases) แผนงานได้วางแนวทางป้องกันความเสี่ยงสำคัญ 5 ประการ:

6.1 ระบบป้องกันข้อมูลชนกัน (Optimistic Concurrency Control)
- **ปัญหา**: พนักงาน 2 คน (เช่น แอดมินรับออเดอร์ กับ ช่างหน้างาน) เปิดแก้ไขงาน P-0309 พร้อมกัน แล้วคนหนึ่งกดบันทึกทับข้อมูลของอีกคนหนึ่ง (Lost Update Anomaly)
- **แนวทางที่ 1 (Native PostgREST - แนะนำ)**:
  ใช้ฟิลด์ `version` เป็นเงื่อนไขในคำสั่ง UPDATE ของ Supabase SDK โดยตรงโดยไม่ต้องสร้าง RPC แยก:
  ```javascript
  const { data, error } = await supabase
    .from('projects')
    .update({ ...payload, version: clientVersion + 1 })
    .eq('id', projectId)
    .eq('version', clientVersion)
    .select();

  if (!data || data.length === 0) {
    // เกิด Conflict: มีผู้ใช้อื่นบันทึกข้อมูลเวอร์ชันใหม่ไปก่อนหน้านี้แล้ว
    handleUpdateConflict(projectId);
  }
  ```
- **แนวทางที่ 2 (PostgreSQL RPC สำหรับคำสั่งแบบ Atomic)**:
  ```sql
  CREATE OR REPLACE FUNCTION update_project_with_lock(
      p_id TEXT,
      p_client_version INT,
      p_patch JSONB
  )
  RETURNS JSONB AS $
  DECLARE
      updated_row JSONB;
  BEGIN
      UPDATE public.projects
      SET name = COALESCE(p_patch->>'name', name),
          deal_status = COALESCE(p_patch->>'deal_status', deal_status),
          wage = COALESCE((p_patch->>'wage')::numeric, wage),
          version = version + 1,
          updated_at = timezone('utc'::text, now())
      WHERE id = p_id AND version = p_client_version
      RETURNING to_jsonb(public.projects.*) INTO updated_row;

      IF NOT FOUND THEN
          RAISE EXCEPTION 'Conflict detected: The record has been modified by another user (expected version %).', p_client_version;
      END IF;

      RETURN updated_row;
  END;
  $ LANGUAGE plpgsql;
  ```
- **UI Conflict Resolution Modal**: เมื่อเกิด Conflict หน้าบ้านจะไม่แสดงหน้าจอ Error ลอยๆ แต่จะแสดงหน้าต่างเปรียบเทียบ (Side-by-side Diff) เพื่อให้ผู้ใช้เลือกว่าจะ "ดึงข้อมูลล่าสุดมาทบทวน" หรือ "บันทึกแยกเป็นฉบับร่าง (Draft Copy)" เพื่อไม่ให้ข้อมูลที่เพิ่งพิมพ์สูญหาย

6.2 มาตรการจัดการตาราง Tombstone และป้องกัน Zombie Records (Stale Client Defense)
- **ปัญหา 1 (ตารางโตไม่หยุด)**: ตาราง `deleted_records` สะสมแถวที่ถูกลบมากขึ้นเรื่อยๆ
  - *การแก้ไข*: ตั้ง Cron Job ล้างข้อมูลที่เก่าเกิน 30 วันอัตโนมัติ:
    ```sql
    DELETE FROM public.deleted_records WHERE deleted_at < NOW() - INTERVAL '30 days';
    ```
- **ปัญหา 2 (Zombie Records ในเครื่องที่ไม่ได้เปิดนาน)**: หากอุปกรณ์สำรองหรือแท็บเล็ตไม่ได้เปิดใช้งานนานเกิน 30 วัน ข้อมูลใน `deleted_records` จะถูกลบไปแล้ว ทำให้เครื่องนั้นไม่รู้ว่ามีรายการไหนถูกลบไปบ้าง และเก็บเรคคอร์ดผีตกค้าง
  - *การแก้ไข*: ฟังก์ชัน `get_project_deltas` มีระบบตรวจจับ `IF p_last_synced_at < (NOW() - INTERVAL '30 days')` หากพบว่าแคชเก่าเกินอายุ Tombstone ระบบจะส่งสัญญาณ `requires_full_resync: true` เพื่อให้ Client สั่งล้าง IndexedDB ท้องถิ่นและโหลดข้อมูลใหม่ทั้งชุดแบบปลอดภัย 100%

6.3 การป้องกันข้อมูลหล่นหายในกลไก Delta Pagination (Watermark Cursor Safety)
- **ปัญหา**: การใช้ `new_watermark := now()` ในการคิวรีที่มี `LIMIT 200` จะทำให้แถวที่ 201 ขึ้นไปถูกข้ามและไม่ถูกดึงลงเครื่องอย่างถาวร
- **การแก้ไข**: 
  - ระบบจะคำนวณ `new_watermark` จาก `MAX(updated_at)` ของแถวสุดท้ายใน Chunk นั้นๆ เสมอ
  - หาก `COUNT(*) = p_limit` ระบบจะส่งค่า `has_more: true` เพื่อให้ Background Sync ทำงานวนลูปดึงทีละ 200 แถวจนครบทุกแถว จึงค่อยเลื่อน Watermark สู่เวลาปัจจุบัน

6.4 นโยบายป้องกันเบราว์เซอร์ลบแคชทิ้ง (Browser Storage Eviction Protection)
- **ปัญหา**: เบราว์เซอร์บนมือถือ (โดยเฉพาะ iOS Safari และ Android Chrome) มีระบบ Storage Eviction ที่จะลบ IndexedDB ทิ้งอัตโนมัติหากพื้นที่ความจำเครื่องใกล้เต็ม หรือเว็บไม่ได้เปิดเกิน 7 วัน
- **การแก้ไข**: ใส่คำสั่งขอสิทธิ์จัดเก็บข้อมูลถาวรตอนโหลดเว็บครั้งแรก:
  ```javascript
  // src/services/localDatabase.js
  export async function ensurePersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log('[Storage] Persistent storage granted:', isPersisted);
    }
  }
  ```
  คำสั่งนี้จะขอให้ระบบปฏิบัติการล็อกพื้นที่ของเว็บไว้ ไม่ให้ถูกกวาดลบเมื่อเครื่องความจำเหลือน้อย

6.5 นโยบายความปลอดภัย Google Drive & ป้องกัน Rate Limit (Apps Script Quota Protection)
- **ปัญหา 1 (ขนาดไฟล์รูปภาพ)**: ผู้ใช้อัปโหลดรูป 5-10MB ทำให้ช้าและกินแบนด์วิดท์
  - *การแก้ไข*: ใช้ Canvas Web Worker บีบอัดรูปเป็น WebP ขนาดไม่เกิน 200KB และกว้างไม่เกิน 1200px ก่อนส่งออกจากเบราว์เซอร์
- **ปัญหา 2 (Google Apps Script Quota & Rate Limit 429)**: หากมีการบันทึกงานหรืออัปโหลดรูปพร้อมๆ กัน อาจเจอข้อจำกัด Burst Rate ของ Google Apps Script
  - *การแก้ไข*: ใส่ระบบ **Exponential Backoff with Jitter** ในฟังก์ชันการอัปโหลดไฟล์ หากส่งไม่สำเร็จ ให้หน่วงเวลารอ 1.5s, 3s, 6s แล้วลองใหม่โดยอัตโนมัติ

7. แผนปฏิบัติการย้ายระบบเป็นระยะ (Phased Migration Roadmap)

flowchart LR
    Phase1["ระยะที่ 1: ติดตั้ง & วาง Schema บน Supabase"] --> Phase2["ระยะที่ 2: สร้างระบบ IndexedDB ในหน้าบ้าน"]
    Phase2 --> Phase3["ระยะที่ 3: สคริปต์ดูดข้อมูลจาก Google Sheets"]
    Phase3 --> Phase4["ระยะที่ 4: สลับการทำงาน & ระบบแคชรูปภาพ Drive"]
    Phase4 --> Phase5["ระยะที่ 5: ตรวจสอบโควต้า Egress & ปิดระบบเดิม"]



รายละเอียดการดำเนินงานแต่ละระยะ:

ระยะที่ 1: เตรียมฐานข้อมูลบน Supabase Cloud (Database Setup)

สร้าง Project บน Supabase (Region: ap-southeast-1 Singapore เพื่อค่า Latency ต่ำสุดสำหรับประเทศไทย $\sim 25-35\text{ms}$)

รันคำสั่ง SQL สร้างตาราง projects, deleted_records พร้อม Optimistic Locking และ Index

ติดตั้งฟังก์ชัน RPC: get_financial_analytics, get_project_deltas และ update_project_with_lock

กำหนดสิทธิ์ความปลอดภัย Row-Level Security (RLS) เพื่อป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต

ระยะที่ 2: วางโครงสร้าง Local-First Engine ในโค้ดหน้าบ้าน (Flower2U)

ติดตั้ง dexie และสร้างโมดูล localDatabase.js พร้อมระบบ Sync Delta ดึงทีละ Chunk

ปรับฟังก์ชันดึงข้อมูลใน src/App.jsx และ src/FinanceView.jsx ให้เชื่อมต่อกับ IndexedDB แทนตัวแปร State ลอยตัว

ปรับแต่งหน้า Dashboard และการ์ดสรุปยอดให้เรียกใช้ get_financial_analytics แทนการใช้ฟังก์ชัน JavaScript .reduce() คำนวณในหน่วยความจำเบราว์เซอร์

ระยะที่ 3: ถ่ายโอนข้อมูลตั้งต้นจาก Google Sheets (ETL Data Migration)

พัฒนาสคริปต์ Node.js หนึ่งชุด (scripts/migrate_sheets_to_supabase.js) เพื่อดึงข้อมูลจาก Google Sheets API/CSV

ทำความสะอาดข้อมูล (Data Sanitization & Type Casting): จัดรูปแบบวันที่ ISO, ตัวเลขการเงิน, แยกคอลัมน์ชื่อลูกค้า, ตรวจสอบ Drive URL/ID

ยิงข้อมูลเข้าสู่ Supabase ผ่านโหมด Ingress Bulk Upsert (ซึ่ง Ingress ไม่จำกัดโควต้าฟรี $100\%$)

ระยะที่ 4: เชื่อมต่อระบบไฟล์มัลติมีเดีย Google Drive (Decoupled Media Setup)

ปรับฟังก์ชันแสดงรูปภาพใน src/components/common/ImageViewer.jsx และ Dropzone การอัปโหลด พร้อมฟังก์ชันบีบอัดรูปก่อนส่ง

รูปภาพขนาด Thumbnail ให้แสดงผลผ่าน Google CDN (https://lh3.googleusercontent.com/d/{id}=w400) เพื่อตัดภาระการดาวน์โหลดรูปผ่านเซิร์ฟเวอร์

เมื่อผู้ใช้เพิ่มรูปใหม่ ให้ฝั่งหน้าบ้านส่งไฟล์ตรงเข้า Google Drive API เช่นเดิม แล้วนำเฉพาะ File ID/URL มาบันทึกลงตาราง Supabase

ระยะที่ 5: ตรวจสอบวัดผล Egress และขึ้นระบบจริง (Verification & Production Cutover)

จำลองการเปิดใช้งานและตรวจสอบ Network Tab ใน Chrome DevTools เพื่อวัดปริมาณ Egress รวมใน $1$ เซสชัน

มอนิเตอร์บน Supabase Dashboard ในแท็บ Usage / Egress (มั่นใจว่าการใช้งานต่อเดือนไม่เกิน $200\text{MB}$ จากโควต้า $5,000\text{MB}$)

ส่งมอบระบบและสำรองข้อมูล Google Sheets เดิมเป็น Archive Reference