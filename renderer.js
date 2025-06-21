const tableBody = document.getElementById("table-body");

const sampleData = [
  ["CR23459-30", "22 Jul 2023", "20:53", "Legal"],
  ["LT4I6590-FD", "22 Jul 2023", "17:11", "Civil"],
  ["FD89565-U5", "21 Jul 2023", "23:09", "Criminal"]
];

sampleData.forEach(row => {
  const tr = document.createElement("tr");
  row.forEach(cell => {
    const td = document.createElement("td");
    td.textContent = cell;
    tr.appendChild(td);
  });

  // Add actions
  const actionTd = document.createElement("td");
  actionTd.innerHTML = `
    <button>Edit</button>
    <button>Delete</button>
  `;
  tr.appendChild(actionTd);
  tableBody.appendChild(tr);
});
