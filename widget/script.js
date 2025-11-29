let chart;

async function loadTasks() {
  const highCount = document.getElementById("highCount");
  const medCount = document.getElementById("mediumCount");
  const lowCount = document.getElementById("lowCount");
  const taskList = document.getElementById("taskList");

  highCount.textContent = medCount.textContent = lowCount.textContent = "⏳";
  taskList.innerHTML = "<li>Loading tasks...</li>";

  try {
    const res = await fetch("https://alethea-foreign-minutely.ngrok-free.dev/api/tasks");
    const tasks = await res.json();

    if (!tasks.length) {
      taskList.innerHTML = "<li>✅ No tasks found.</li>";
      return;
    }

    // Group by priority
    const high = tasks.filter(t => t.priority === "High");
    const med = tasks.filter(t => t.priority === "Medium");
    const low = tasks.filter(t => t.priority === "Low");

    // Update counters
    highCount.textContent = high.length;
    medCount.textContent = med.length;
    lowCount.textContent = low.length;

    // Render chart
    renderChart(high.length, med.length, low.length);

    // Recent tasks
    taskList.innerHTML = "";
    tasks.slice(0, 8).forEach(task => {
      const li = document.createElement("li");
      li.className = `priority-${task.priority.toLowerCase()}`;
      li.innerHTML = `
        <strong>${task.title}</strong><br>
        👤 ${task.assignee || "—"} | 📅 ${task.due || "—"} | ⚡ ${task.priority}
      `;
      taskList.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    taskList.innerHTML = "<li>⚠️ Failed to load tasks. Try again.</li>";
  }
}

function renderChart(high, med, low) {
  const ctx = document.getElementById("priorityChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        data: [high, med, low],
        backgroundColor: ["#e74c3c", "#f39c12", "#2ecc71"],
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

window.onload = loadTasks;
