#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_DIR="${SCRIPT_DIR}/../../.harness/metrics"

ACTION="${1:-show}"
FORMAT="table"
RUN_FILTER=""

for arg in "$@"; do
    case "$arg" in
        --json) FORMAT="json" ;;
        --run=*) RUN_FILTER="${arg#--run=}" ;;
        -h|--help) ACTION="help" ;;
    esac
done

show_summary() {
    local total_runs=0
    local total_gates=0
    local passed_gates=0
    local failed_gates=0

    if [[ -d "$METRICS_DIR" ]]; then
        while IFS= read -r -d '' f; do
            [[ -f "$f" ]] || continue
            while IFS= read -r line; do
                [[ -z "$line" ]] && continue
                if [[ -n "$RUN_FILTER" ]] && ! echo "$line" | grep -q "\"runId\":\"${RUN_FILTER}\""; then
                    continue
                fi
                ((total_gates++)) || true
                if echo "$line" | grep -q '"passed":true'; then
                    ((passed_gates++)) || true
                else
                    ((failed_gates++)) || true
                fi
            done < "$f"
        done < <(find "$METRICS_DIR" -name '*.jsonl' -print0 2>/dev/null)

        total_runs=$(grep -roh '"runId":"[^"]*"' "$METRICS_DIR"/ 2>/dev/null | sort -u | wc -l | tr -d ' ') || true
    fi

    if [[ "$FORMAT" == "json" ]]; then
        local pass_rate="0"
        if [[ $total_gates -gt 0 ]]; then
            pass_rate=$(awk "BEGIN {printf \"%.2f\", $passed_gates / $total_gates * 100}")
        fi
        echo "{\"totalRuns\":$total_runs,\"totalGates\":$total_gates,\"passedGates\":$passed_gates,\"failedGates\":$failed_gates,\"passRate\":$pass_rate}"
    else
        echo "=== Harness Metrics Summary ==="
        echo ""
        printf "  %-18s %s\n" "Total Runs:" "$total_runs"
        printf "  %-18s %s\n" "Total Gate Checks:" "$total_gates"
        printf "  %-18s %s\n" "Passed:" "$passed_gates"
        printf "  %-18s %s\n" "Failed:" "$failed_gates"
        if [[ $total_gates -gt 0 ]]; then
            local rate
            rate=$(awk "BEGIN {printf \"%.1f\", $passed_gates * 100 / $total_gates}")
            printf "  %-18s %s\n" "Pass Rate:" "${rate}%"
        fi
        if [[ -n "$RUN_FILTER" ]]; then
            printf "  %-18s %s\n" "Filter (runId):" "$RUN_FILTER"
        fi
    fi
}

show_details() {
    if [[ ! -d "$METRICS_DIR" ]]; then
        echo "No metrics data found. Run a gate check or pipeline first."
        exit 0
    fi

    local file_count
    file_count=$(find "$METRICS_DIR" -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$file_count" -eq 0 ]]; then
        echo "No metrics data files found in $METRICS_DIR"
        exit 0
    fi

    if [[ "$FORMAT" == "json" ]]; then
        echo "["
        local first=true
        while IFS= read -r -d '' f; do
            [[ -f "$f" ]] || continue
            while IFS= read -r line; do
                [[ -z "$line" ]] && continue
                if [[ -n "$RUN_FILTER" ]] && ! echo "$line" | grep -q "\"runId\":\"${RUN_FILTER}\""; then
                    continue
                fi
                if [[ "$first" == "true" ]]; then
                    first=false
                else
                    echo ","
                fi
                echo -n "  $line"
            done < "$f"
        done < <(find "$METRICS_DIR" -name '*.jsonl' -print0 2>/dev/null)
        echo ""
        echo "]"
    else
        echo "=== Gate Results ==="
        printf "%-20s %-8s %10s %s\n" "GATE" "STATUS" "DURATION" "TIMESTAMP"
        printf "%-20s %-8s %10s %s\n" "----" "------" "--------" "---------"

        local row_count=0
        while IFS= read -r -d '' f; do
            [[ -f "$f" ]] || continue
            while IFS= read -r line; do
                [[ -z "$line" ]] && continue
                if [[ -n "$RUN_FILTER" ]] && ! echo "$line" | grep -q "\"runId\":\"${RUN_FILTER}\""; then
                    continue
                fi

                local gate_id status duration timestamp
                gate_id=$(echo "$line" | grep -o '"gateId":"[^"]*"' | head -1 | cut -d'"' -f4)
                status=$(echo "$line" | grep -o '"passed":[^,}]*' | head -1 | cut -d':' -f2)
                duration=$(echo "$line" | grep -o '"durationMs":[^,}]*' | head -1 | cut -d':' -f2)
                timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | head -1 | cut -d'"' -f4)

                if [[ "$status" == "true" ]]; then
                    status="PASS"
                elif [[ "$status" == "false" ]]; then
                    status="FAIL"
                else
                    status="----"
                fi

                duration="${duration:-0}"

                if command -v node &> /dev/null; then
                    # 使用 Node.js 替代 python3，避免额外子进程依赖
                    timestamp=$(echo "$timestamp" | node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log(t.slice(0,19));});" 2>/dev/null || echo "${timestamp:-N/A}")
                else
                    timestamp="${timestamp:-N/A}"
                fi

                printf "%-20s %-8s %10sms   %s\n" "${gate_id:--}" "$status" "$duration" "${timestamp:-N/A}"
                ((row_count++)) || true
            done < "$f"
        done < <(find "$METRICS_DIR" -name '*.jsonl' -print0 2>/dev/null)

        if [[ "$row_count" -eq 0 ]]; then
            if [[ -n "$RUN_FILTER" ]]; then
                echo ""
                echo "No records matching runId=\"$RUN_FILTER\"."
            fi
        fi
    fi
}

show_help() {
    cat <<'EOF'
Usage: ./metrics.sh [show|summary] [--json] [--run RUN_ID]

Commands:
  show     Show detailed gate results (default)
  summary  Show aggregated metrics summary
  help     Show this help message

Options:
  --json       Output in JSON format
  --run ID     Filter by specific run ID

Examples:
  ./metrics.sh                  # Show detailed results
  ./metrics.sh summary          # Show aggregated summary
  ./metrics.sh summary --json   # Summary as JSON
  ./metrics.sh show --run run-123456  # Filter by run ID
EOF
}

case "$ACTION" in
    summary|-s) show_summary ;;
    show|details|*) show_details ;;
    help|--help|-h) show_help ;;
esac
