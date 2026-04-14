const fs = require("fs");
const path = require("path");

class Storage {
  constructor(dir = "./data") {
    this.dir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getFilePath(name) {
    return path.join(this.dir, `${name}.json`);
  }

  save(name, data) {
    try {
      const file = this.getFilePath(name);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error(`Storage save error (${name}):`, err.message);
      return false;
    }
  }

  load(name, defaultValue = null) {
    try {
      const file = this.getFilePath(name);
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error(`Storage load error (${name}):`, err.message);
    }
    return defaultValue;
  }

  exists(name) {
    return fs.existsSync(this.getFilePath(name));
  }

  delete(name) {
    try {
      const file = this.getFilePath(name);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        return true;
      }
    } catch (err) {
      console.error(`Storage delete error (${name}):`, err.message);
    }
    return false;
  }

  increment(name, key, amount = 1) {
    const data = this.load(name, {});
    data[key] = (data[key] || 0) + amount;
    this.save(name, data);
    return data[key];
  }

  append(name, item, maxItems = 1000) {
    const data = this.load(name, []);
    if (!Array.isArray(data)) {
      console.warn(`Storage: ${name} is not an array`);
      return [];
    }

    data.push(item);
    if (data.length > maxItems) {
      data.shift();
    }

    this.save(name, data);
    return data;
  }
}

module.exports = Storage;
